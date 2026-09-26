from fastapi import FastAPI
from api.endpoints import health, ingestion, chat
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Data Analyst API")

app.include_router(health.router, tags=["Health"])
app.include_router(ingestion.router, tags=["Ingestion"])
app.include_router(chat.router, tags=["Chat & Query Testing"])
