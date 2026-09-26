from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
from services.data_engine import register_dataframe, profile_dataframe

router = APIRouter()

@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        # Sanitize table name
        table_name = file.filename.replace(".csv", "").replace(" ", "_").replace("-", "_").lower()
        
        # Register in DuckDB
        register_dataframe(table_name, df)
        
        # Profile
        profile = profile_dataframe(df)
        
        return {
            "message": f"Successfully uploaded and registered {table_name}",
            "table_name": table_name,
            "profile": profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.delete("/datasets/{table_name}")
async def delete_dataset(table_name: str):
    try:
        from services.data_engine import delete_dataframe
        delete_dataframe(table_name)
        return {"message": f"Successfully deleted {table_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting dataset: {str(e)}")

@router.get("/datasets/{table_name}/data")
async def get_dataset_data(table_name: str):
    try:
        from services.data_engine import get_table_data
        data = get_table_data(table_name)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
