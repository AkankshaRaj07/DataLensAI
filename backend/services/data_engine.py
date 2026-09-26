import duckdb
import pandas as pd
from typing import Dict, Any, List

# Create a persistent DuckDB connection
con = duckdb.connect("ai_data_analyst.duckdb")

def register_dataframe(table_name: str, df: pd.DataFrame):
    """Registers a Pandas dataframe as a DuckDB table."""
    con.register(f"temp_{table_name}", df)
    # Create a physical table from it
    con.execute(f"CREATE OR REPLACE TABLE {table_name} AS SELECT * FROM temp_{table_name}")

def profile_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Generates a profile of the dataframe for the LLM."""
    profile = []
    for col in df.columns:
        col_type = str(df[col].dtype)
        col_stats = {
            "name": col,
            "type": col_type,
            "null_percentage": round((df[col].isnull().sum() / len(df)) * 100, 2),
            "unique_count": int(df[col].nunique()),
        }
        
        # Sample values
        valid_samples = df[col].dropna().unique()
        col_stats["sample_values"] = valid_samples[:3].tolist() if len(valid_samples) > 0 else []

        if pd.api.types.is_numeric_dtype(df[col]):
            col_stats["min"] = float(df[col].min()) if not pd.isna(df[col].min()) else None
            col_stats["max"] = float(df[col].max()) if not pd.isna(df[col].max()) else None
            
        profile.append(col_stats)
        
    return {
        "row_count": len(df),
        "columns": profile
    }

def delete_dataframe(table_name: str):
    """Deletes a table from DuckDB."""
    try:
        con.execute(f"DROP TABLE IF EXISTS {table_name}")
    except:
        pass

def get_table_data(table_name: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Fetches sample data from a table."""
    try:
        df = con.execute(f"SELECT * FROM {table_name} LIMIT {limit}").fetchdf()
        # Convert any date/time columns to string for JSON serialization
        for col in df.select_dtypes(include=['datetime64', 'timedelta64']).columns:
            df[col] = df[col].astype(str)
        return df.to_dict(orient='records')
    except:
        return []
