from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class EvaluationConfig:
    top_k: int = 10
    numeric_tolerance: float = 0.001
    faithfulness_model: str = "rule_based_v1"
    langfuse_enabled: bool = False
    evaluation_batch_size: int = 5
    save_traces: bool = True
    report_directory: str = "evaluation"
    agent_url: str = "http://localhost:4000/agent/ask"
    request_timeout_seconds: int = 60


def load_evaluation_config(path: str | Path = "config/evaluation.yaml") -> EvaluationConfig:
    config_path = Path(path)
    raw = _parse_simple_yaml(config_path.read_text(encoding="utf-8"))
    return EvaluationConfig(
        top_k=_as_int(raw.get("top_k"), 10),
        numeric_tolerance=_as_float(raw.get("numeric_tolerance"), 0.001),
        faithfulness_model=str(raw.get("faithfulness_model", "rule_based_v1")),
        langfuse_enabled=_as_bool(raw.get("langfuse_enabled"), False),
        evaluation_batch_size=_as_int(raw.get("evaluation_batch_size"), 5),
        save_traces=_as_bool(raw.get("save_traces"), True),
        report_directory=str(raw.get("report_directory", "evaluation")),
        agent_url=str(raw.get("agent_url", "http://localhost:4000/agent/ask")),
        request_timeout_seconds=_as_int(raw.get("request_timeout_seconds"), 60),
    )


def _parse_simple_yaml(content: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if ":" not in stripped:
            raise ValueError(f"Invalid YAML line: {line}")

        key, value = stripped.split(":", 1)
        parsed[key.strip()] = value.strip()

    return parsed


def _as_int(value: object, fallback: int) -> int:
    if value is None or value == "":
        return fallback
    return int(str(value))


def _as_float(value: object, fallback: float) -> float:
    if value is None or value == "":
        return fallback
    return float(str(value))


def _as_bool(value: object, fallback: bool) -> bool:
    if value is None or value == "":
        return fallback

    normalized = str(value).strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False

    raise ValueError(f"Expected boolean-compatible value, got {value!r}")

