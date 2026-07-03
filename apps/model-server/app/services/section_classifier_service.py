from app.core.config import Settings, get_settings
from app.models.registry import ModelRegistry


class SectionClassifierService:
    def __init__(self, model_registry: ModelRegistry, settings: Settings | None = None):
        self.model_registry = model_registry
        self.settings = settings or get_settings()

    def classify(self, text: str, candidate_labels: list[str]) -> tuple[str, float]:
        model = self.model_registry.get_section_classifier_pipeline()
        result = model(
            text,
            candidate_labels=candidate_labels,
            truncation=True,
            max_length=self.settings.model_max_sequence_length,
        )

        labels = result.get("labels", []) if isinstance(result, dict) else []
        scores = result.get("scores", []) if isinstance(result, dict) else []

        if not labels or not scores:
            return "", 0

        return str(labels[0]), float(scores[0])
