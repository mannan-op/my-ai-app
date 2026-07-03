from dataclasses import dataclass
from threading import Lock
from typing import Any

from app.core.config import Settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class LoadedModel:
    name: str
    task: str
    instance: Any
    device: int


class ModelRegistry:
    """Lazy singleton registry for model pipelines used by the model server."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._models: dict[str, LoadedModel] = {}
        self._lock = Lock()

    def preload_mvp_models(self) -> None:
        self.get_table_qa_pipeline()
        self.get_nli_pipeline()

    def get_table_qa_pipeline(self) -> Any:
        return self._get_or_load(
            key="table_qa",
            task="table-question-answering",
            model_name=self.settings.tapas_model_name,
        ).instance

    def get_nli_pipeline(self) -> Any:
        return self._get_or_load(
            key="nli",
            task="text-classification",
            model_name=self.settings.nli_model_name,
        ).instance

    def _get_or_load(self, key: str, task: str, model_name: str) -> LoadedModel:
        with self._lock:
            existing = self._models.get(key)

            if existing is not None:
                return existing

            device = select_device(self.settings.model_device)
            logger.info(
                "loading_model",
                extra={"model_key": key, "task": task, "model_name": model_name, "device": device},
            )

            from transformers import pipeline

            kwargs: dict[str, Any] = {
                "model": model_name,
                "tokenizer": model_name,
                "device": device,
            }
            model_kwargs = _model_kwargs(self.settings)

            if model_kwargs is not None:
                kwargs["model_kwargs"] = model_kwargs

            model = pipeline(task, **kwargs)
            loaded = LoadedModel(name=model_name, task=task, instance=model, device=device)
            self._models[key] = loaded
            return loaded


def select_device(configured_device: str) -> int:
    normalized = configured_device.strip().lower()

    if normalized == "cpu":
        return -1

    if normalized.startswith("cuda:"):
        try:
            return int(normalized.split(":", 1)[1])
        except ValueError:
            return 0

    if normalized.isdigit():
        return int(normalized)

    if normalized == "auto":
        try:
            import torch

            return 0 if torch.cuda.is_available() else -1
        except Exception:
            return -1

    return -1


def _model_kwargs(settings: Settings) -> dict[str, str] | None:
    if settings.model_cache_dir is None:
        return None

    return {"cache_dir": settings.model_cache_dir}
