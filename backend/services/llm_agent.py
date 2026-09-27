import json
import os
import logging
from typing import List, Dict, Any
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from services.tools import run_sql, run_pandas, generate_chart, detect_anomalies

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

def run_sql_tool(query: str = "", queries: str = "") -> str:
    """Executes a SQL query against the loaded datasets using DuckDB and returns the results as JSON. You MUST pass the SQL to the 'query' argument."""
    return run_sql(query or queries)

def run_pandas_tool(code: str) -> str:
    """Executes sandboxed pandas Python code. You have access to pd, np, and all table names as variables. You MUST assign the final output to a variable named 'result'."""
    return run_pandas(code)

def generate_chart_tool(data: list, chart_type: str, x: str, y: str, title: str) -> str:
    """Generates a Plotly chart spec from provided data. chart_type must be one of: bar, line, scatter, pie."""
    return generate_chart(data, chart_type, x, y, title)

def detect_anomalies_tool(table: str, columns: list) -> str:
    """Runs deterministic IQR anomaly detection on numeric columns for a table."""
    return detect_anomalies(table, columns)

async def process_chat_message(
    user_message: str,
    table_schemas: List[Dict[str, Any]],
    conversation_history: List[Dict[str, Any]]
) -> Dict[str, Any]:
    
    for schema in table_schemas:
        if 'table_name' not in schema and 'filename' in schema:
            schema['table_name'] = schema['filename'].replace('.csv', '').replace(' ', '_').replace('-', '_').lower()

    system_prompt = (
        "You are an AI Data Analyst. You answer questions about datasets by writing and executing SQL or Pandas code.\n"
        "Here are the loaded table schemas and profiles:\n"
        f"{json.dumps(table_schemas, indent=2)}\n\n"
        "CRITICAL RULES:\n"
        "- NEVER hallucinate numbers. You must call the tools to get real data.\n"
        "- ALWAYS explain your reasoning and reference the numbers returned by the tools.\n"
        "- When writing SQL, use the EXACT `table_name` from the schemas above. Do not use the filename or .csv extension.\n"
        "- When writing Pandas, the dataset is injected as a global variable with the exact `table_name`.\n"
        "- If the user asks for a chart, use the generate_chart_tool with data retrieved from SQL/Pandas.\n"
        "- If the user asks to find anomalies, use the detect_anomalies tool.\n"
    )

    try:
        model = genai.GenerativeModel(
            model_name='gemini-flash-lite-latest',
            tools=[run_sql_tool, run_pandas_tool, generate_chart_tool, detect_anomalies_tool],
            system_instruction=system_prompt
        )
        
        chat = model.start_chat(enable_automatic_function_calling=True)

        @retry(
            wait=wait_exponential(multiplier=1, min=2, max=5),
            stop=stop_after_attempt(2),
            retry=retry_if_exception_type(ResourceExhausted)
        )
        def _send():
            return chat.send_message(user_message)

        response = _send()
        
        def unwrap(val):
            if hasattr(val, 'items'):
                return {k: unwrap(v) for k, v in val.items()}
            if hasattr(val, '__iter__') and not isinstance(val, (str, bytes)):
                return [unwrap(v) for v in val]
            return val

        trace = []
        for msg in chat.history:
            if msg.role == 'model' and msg.parts:
                for part in msg.parts:
                    if part.function_call:
                        args = unwrap(part.function_call.args)
                        trace.append({"tool": part.function_call.name, "input": args})
            elif msg.role == 'user' and msg.parts:
                for part in msg.parts:
                    if part.function_response:
                        res = part.function_response.response.get("result", "")
                        try:
                            parsed_res = json.loads(res) if isinstance(res, str) else res
                        except:
                            parsed_res = res
                        
                        if trace:
                            trace[-1]["tool_result"] = parsed_res
                        else:
                            trace.append({"tool_result": parsed_res})

        return {
            "answer": response.text,
            "trace": trace
        }
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"LLM Error: {error_str}")
        
        if "ResourceExhausted" in error_str or "429" in error_str:
            friendly_msg = "You have hit the Google Gemini API free-tier rate limit (15 requests per minute). Please wait about 60 seconds and try asking your question again!"
            return {"error": error_str, "answer": friendly_msg}
            
        return {"error": error_str, "answer": f"I encountered an error while processing your request: {error_str}"}

