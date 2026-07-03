from typing import Any

from pydantic import BaseModel, Field, field_validator


TableRow = dict[str, str | int | float | bool | None]
DEFAULT_SECTION_LABELS = [
    "business",
    "risk factors",
    "management discussion and analysis",
    "financial statements",
    "notes to financial statements",
    "legal proceedings",
    "controls and procedures",
    "other",
]


class TableQARequest(BaseModel):
    table: list[TableRow] = Field(..., min_length=1)
    question: str = Field(..., min_length=1)

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        stripped = value.strip()

        if not stripped:
            raise ValueError("Question must not be empty")

        return stripped


class TableQAResponse(BaseModel):
    answer: str


class NLIRequest(BaseModel):
    premise: str = Field(..., min_length=1)
    hypothesis: str = Field(..., min_length=1)

    @field_validator("premise", "hypothesis")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()

        if not stripped:
            raise ValueError("Text fields must not be empty")

        return stripped


class NLIResponse(BaseModel):
    label: str
    score: float = Field(..., ge=0, le=1)


class NLIResult(BaseModel):
    label: str
    score: float


class ImageQARequest(BaseModel):
    image_base64: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)

    @field_validator("image_base64", "question")
    @classmethod
    def strip_fields(cls, value: str) -> str:
        stripped = value.strip()

        if not stripped:
            raise ValueError("Fields must not be empty")

        return stripped


class QAResponse(BaseModel):
    answer: str
    score: float | None = Field(default=None, ge=0, le=1)


class SectionClassificationRequest(BaseModel):
    text: str = Field(..., min_length=1)
    candidate_labels: list[str] = Field(default_factory=lambda: DEFAULT_SECTION_LABELS.copy())

    @field_validator("text")
    @classmethod
    def strip_text_field(cls, value: str) -> str:
        stripped = value.strip()

        if not stripped:
            raise ValueError("Text must not be empty")

        return stripped

    @field_validator("candidate_labels")
    @classmethod
    def validate_candidate_labels(cls, value: list[str]) -> list[str]:
        labels = [label.strip() for label in value if label.strip()]

        if not labels:
            raise ValueError("candidate_labels must contain at least one non-empty label")

        return labels


class SectionClassificationResponse(BaseModel):
    label: str
    score: float = Field(..., ge=0, le=1)


PipelineResult = dict[str, Any] | list[dict[str, Any]]

