import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str
    model_cache_dir: str | None
    model_device: str
    model_batch_size: int
    model_max_sequence_length: int
    tapas_model_name: str
    nli_model_name: str
    preload_models: bool


def get_settings() -> Settings:
    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        model_cache_dir=os.getenv("MODEL_CACHE_DIR") or None,
        model_device=os.getenv("MODEL_DEVICE", "auto"),
        model_batch_size=_positive_int("MODEL_BATCH_SIZE", 1),
        model_max_sequence_length=_positive_int("MODEL_MAX_SEQUENCE_LENGTH", 512),
        tapas_model_name=os.getenv("TAPAS_MODEL_NAME", "google/tapas-base-finetuned-wtq"),
        nli_model_name=os.getenv("NLI_MODEL_NAME", "cross-encoder/nli-deberta-v3-small"),
        preload_models=_bool("MODEL_PRELOAD", False),
    )


def _positive_int(name: str, default: int) -> int:
    raw_value = os.getenv(name)

    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    return value if value > 0 else default


def _bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)

    if raw_value is None:
        return default

    return raw_value.strip().lower() in {"1", "true", "yes", "on"}

