import os
from fastapi import FastAPI

app = FastAPI(title="Model Server", version="0.1.0")


@app.get("/")
def root():
    return {
        "message": "Model server is running"
    }


@app.get("/health")
def health():
    return {
        "service": "model-server",
        "status": "ok",
        "environment": os.getenv("APP_ENV", "development")
    }