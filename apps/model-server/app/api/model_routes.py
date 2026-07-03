from fastapi import APIRouter, HTTPException, Request

from app.core.logging import get_logger
from app.schemas.inference import (
    NLIRequest,
    NLIResponse,
    TableQARequest,
    TableQAResponse,
)
from app.services.nli_service import NLIService
from app.services.table_qa_service import InvalidTableError, TableQAService

router = APIRouter()
logger = get_logger(__name__)


@router.post("/table/qa", response_model=TableQAResponse)
def table_qa(payload: TableQARequest, request: Request) -> TableQAResponse:
    logger.info(
        "table_qa_request",
        extra={
            "row_count": len(payload.table),
            "question_length": len(payload.question),
        },
    )

    try:
        service = TableQAService(request.app.state.model_registry)
        answer = service.answer_question(payload.table, payload.question)
        return TableQAResponse(answer=answer)
    except InvalidTableError as exc:
        logger.warning("table_qa_invalid_table", extra={"error": str(exc)})
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("table_qa_failed")
        raise HTTPException(status_code=500, detail="Table question answering failed") from exc


@router.post("/verify/nli", response_model=NLIResponse)
def verify_nli(payload: NLIRequest, request: Request) -> NLIResponse:
    logger.info(
        "nli_request",
        extra={
            "premise_length": len(payload.premise),
            "hypothesis_length": len(payload.hypothesis),
        },
    )

    try:
        service = NLIService(request.app.state.model_registry)
        result = service.verify(payload.premise, payload.hypothesis)
        return NLIResponse(label=result.label, score=result.score)
    except Exception as exc:
        logger.exception("nli_failed")
        raise HTTPException(status_code=500, detail="NLI verification failed") from exc

