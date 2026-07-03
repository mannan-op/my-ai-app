from typing import Any

from pydantic import BaseModel, Field, field_validator


TableRow = dict[str, str | int | float | bool | None]


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


PipelineResult = dict[str, Any] | list[dict[str, Any]]

