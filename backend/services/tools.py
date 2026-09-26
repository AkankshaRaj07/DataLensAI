import duckdb
from services.data_engine import con
import json
import logging
import pandas as pd
import numpy as np
import plotly.express as px

logger = logging.getLogger(__name__)

def run_sql(query: str) -> str:
    """Execute SQL via DuckDB, return rows as JSON."""
    try:
        logger.info(f"Running SQL: {query}")
        result = con.execute(query).df().to_json(orient="records")
        return result
    except Exception as e:
        logger.error(f"Error running SQL: {e}")
        return json.dumps({"error": str(e)})

def run_pandas(code: str) -> str:
    """Execute sandboxed pandas code against loaded DataFrames."""
    try:
        logger.info(f"Running Pandas code: {code}")
        tables = con.execute("SHOW TABLES").df()
        local_env = {"pd": pd, "np": np}
        for _, row in tables.iterrows():
            tbl_name = row['name']
            if not tbl_name.startswith('temp_'):
                local_env[tbl_name] = con.execute(f"SELECT * FROM {tbl_name}").df()
        
        exec_env = {**local_env}
        exec(code, exec_env)
        
        result = exec_env.get('result', None)
        if result is None:
            return json.dumps({"error": "Code executed successfully but no 'result' variable was defined."})
            
        if isinstance(result, pd.DataFrame):
            return result.to_json(orient="records")
        elif hasattr(result, "item"):
            return str(result.item())
        else:
            return str(result)
            
    except Exception as e:
        logger.error(f"Error running Pandas code: {e}")
        return json.dumps({"error": str(e)})

def generate_chart(data: list, chart_type: str, x: str, y: str, title: str) -> str:
    """Build a Plotly figure and return spec as JSON."""
    try:
        logger.info(f"Generating chart: {chart_type} for x={x}, y={y}")
        df = pd.DataFrame(data)
        
        if chart_type == "bar":
            # Wrap long category names into multiple lines using HTML <br> tags
            import textwrap
            if df[x].dtype == 'object':
                df[x] = df[x].apply(lambda val: '<br>'.join(textwrap.wrap(str(val), width=8)))
                
            fig = px.bar(
                df, x=x, y=y, title=title, 
                color=y, 
                color_continuous_scale=['#6366f1', '#10b981'],
                text_auto=True
            )
            fig.update_layout(
                bargap=0.7, 
                xaxis={'categoryorder':'total descending'},
                coloraxis_showscale=False
            )
            fig.update_traces(textposition='outside')
        elif chart_type == "line":
            fig = px.line(df, x=x, y=y, title=title, color_discrete_sequence=['#059669'])
        elif chart_type == "scatter":
            fig = px.scatter(df, x=x, y=y, title=title, color_discrete_sequence=['#059669'])
        elif chart_type == "pie":
            fig = px.pie(df, names=x, values=y, title=title, color_discrete_sequence=px.colors.sequential.Teal)
        else:
            return json.dumps({"error": f"Unsupported chart type: {chart_type}"})
            
        return fig.to_json()
    except Exception as e:
        logger.error(f"Error generating chart: {e}")
        return json.dumps({"error": str(e)})

def detect_anomalies(table: str, columns: list) -> str:
    """Run IQR outlier detection per numeric column."""
    try:
        logger.info(f"Detecting anomalies for {table} on columns: {columns}")
        df = con.execute(f"SELECT * FROM {table}").df()
        anomalies = []
        
        for col in columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                q1 = df[col].quantile(0.25)
                q3 = df[col].quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                flagged = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                if not flagged.empty:
                    for idx, row in flagged.iterrows():
                        anomalies.append({
                            "column": col,
                            "value": float(row[col]),
                            "reason": f"Value {row[col]} is outside the normal IQR bounds of [{lower_bound:.2f}, {upper_bound:.2f}]",
                            "row_index": idx
                        })
        return json.dumps({"anomalies": anomalies})
    except Exception as e:
        logger.error(f"Error detecting anomalies: {e}")
        return json.dumps({"error": str(e)})
