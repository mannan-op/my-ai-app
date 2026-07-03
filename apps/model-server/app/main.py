from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.model_routes import router as model_router
from app.api.pdf_routes import router as pdf_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.models.registry import ModelRegistry

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry = ModelRegistry(settings)
    app.state.model_registry = registry

    if settings.preload_models:
        logger.info("preloading_mvp_models")
        registry.preload_mvp_models()

    yield


app = FastAPI(title="Model Server", version="0.2.0", lifespan=lifespan)
app.include_router(pdf_router)
app.include_router(model_router)

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
        "environment": settings.app_env
    }
