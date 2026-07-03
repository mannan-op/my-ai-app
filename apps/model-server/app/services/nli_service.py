from app.core.config import Settings, get_settings
from app.models.registry import ModelRegistry
from app.schemas.inference import NLIResult


class NLIService:
    def __init__(self, model_registry: ModelRegistry, settings: Settings | None = None):
        self.model_registry = model_registry
        self.settings = settings or get_settings()

    def verify(self, premise: str, hypothesis: str) -> NLIResult:
        model = self.model_registry.get_nli_pipeline()
        result = model(
            {"text": premise, "text_pair": hypothesis},
            truncation=True,
            max_length=self.settings.model_max_sequence_length,
        )
        item = result[0] if isinstance(result, list) else result
        raw_label = str(item.get("label", "NEUTRAL"))
        score = float(item.get("score", 0))

        return NLIResult(label=normalize_nli_label(raw_label), score=score)


def normalize_nli_label(label: str) -> str:
    normalized = label.strip().upper()

    if normalized in {"ENTAILMENT", "CONTRADICTION", "NEUTRAL"}:
        return normalized

    if normalized in {"LABEL_0", "0"}:
        return "CONTRADICTION"

    if normalized in {"LABEL_1", "1"}:
        return "NEUTRAL"

    if normalized in {"LABEL_2", "2"}:
        return "ENTAILMENT"

    return normalized

