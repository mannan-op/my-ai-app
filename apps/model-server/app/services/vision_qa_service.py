from app.models.registry import ModelRegistry
from app.services.image_utils import decode_base64_image


class VisionQAService:
    def __init__(self, model_registry: ModelRegistry):
        self.model_registry = model_registry

    def answer_question(self, image_base64: str, question: str) -> tuple[str, float | None]:
        image = decode_base64_image(image_base64)
        model = self.model_registry.get_vision_qa_pipeline()
        result = model(image=image, question=question)
        item = result[0] if isinstance(result, list) and result else result

        if not isinstance(item, dict):
            return "", None

        answer = item.get("answer")
        score = item.get("score")

        return str(answer) if answer is not None else "", _optional_score(score)


def _optional_score(value: object) -> float | None:
    if value is None:
        return None

    return float(value)

