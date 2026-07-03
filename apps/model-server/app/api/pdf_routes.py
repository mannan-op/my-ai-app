from fastapi import APIRouter, File, HTTPException, UploadFile

from app.pdf_extraction import extract_pdf_regions

router = APIRouter()


@router.post("/pdf/extract")
async def extract_pdf(file: UploadFile = File(...)):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    pdf_bytes = await file.read()

    try:
        return extract_pdf_regions(pdf_bytes)
    except ValueError as exc:
        if str(exc) == "invalid_pdf":
            raise HTTPException(
                status_code=400,
                detail="The uploaded file could not be read as a PDF",
            ) from exc
        raise

