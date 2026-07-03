from fastapi import APIRouter, HTTPException, Request

from app.core.logging import get_logger
from app.schemas.inference import (
    ImageQARequest,
    NLIRequest,
    NLIResponse,
    QAResponse,
    SectionClassificationRequest,
    SectionClassificationResponse,
    TableQARequest,
    TableQAResponse,
)
from app.services.image_utils import InvalidImageError
from app.services.layout_document_qa_service import LayoutDocumentQAService
from app.services.nli_service import NLIService
from app.services.section_classifier_service import SectionClassifierService
from app.services.table_qa_service import InvalidTableError, TableQAService
from app.services.vision_qa_service import VisionQAService

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


@router.post("/layout/document-qa", response_model=QAResponse)
def layout_document_qa(payload: ImageQARequest, request: Request) -> QAResponse:
    logger.info(
        "layout_document_qa_request",
        extra={"question_length": len(payload.question)},
    )

    try:
        service = LayoutDocumentQAService(request.app.state.model_registry)
        answer, score = service.answer_question(payload.image_base64, payload.question)
        return QAResponse(answer=answer, score=score)
    except InvalidImageError as exc:
        logger.warning("layout_document_qa_invalid_image", extra={"error": str(exc)})
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("layout_document_qa_failed")
        raise HTTPException(status_code=500, detail="Layout document QA failed") from exc


@router.post("/vision/qa", response_model=QAResponse)
def vision_qa(payload: ImageQARequest, request: Request) -> QAResponse:
    logger.info(
        "vision_qa_request",
        extra={"question_length": len(payload.question)},
    )

    try:
        service = VisionQAService(request.app.state.model_registry)
        answer, score = service.answer_question(payload.image_base64, payload.question)
        return QAResponse(answer=answer, score=score)
    except InvalidImageError as exc:
        logger.warning("vision_qa_invalid_image", extra={"error": str(exc)})
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("vision_qa_failed")
        raise HTTPException(status_code=500, detail="Vision QA failed") from exc


@router.post("/classify/section", response_model=SectionClassificationResponse)
def classify_section(
    payload: SectionClassificationRequest,
    request: Request,
) -> SectionClassificationResponse:
    logger.info(
        "section_classification_request",
        extra={
            "text_length": len(payload.text),
            "candidate_label_count": len(payload.candidate_labels),
        },
    )

    try:
        service = SectionClassifierService(request.app.state.model_registry)
        label, score = service.classify(payload.text, payload.candidate_labels)
        return SectionClassificationResponse(label=label, score=score)
    except Exception as exc:
        logger.exception("section_classification_failed")
        raise HTTPException(status_code=500, detail="Section classification failed") from exc

