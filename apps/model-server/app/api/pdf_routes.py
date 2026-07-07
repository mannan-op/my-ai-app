from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.pdf_extraction import extract_pdf_regions, render_pdf_page

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


@router.post("/pdf/render-page")
async def render_page(
    file: UploadFile = File(...),
    page: int = Query(..., ge=1),
    scale: float = Query(2.0, ge=0.5, le=4.0),
):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    pdf_bytes = await file.read()

    try:
        image_bytes, page_width, page_height = render_pdf_page(pdf_bytes, page, scale)
    except ValueError as exc:
        if str(exc) == "invalid_pdf":
            raise HTTPException(
                status_code=400,
                detail="The uploaded file could not be read as a PDF",
            ) from exc
        if str(exc) == "invalid_page":
            raise HTTPException(status_code=400, detail="Page number is out of range") from exc
        raise

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "X-Page-Width": str(page_width),
            "X-Page-Height": str(page_height),
            "X-Render-Scale": str(scale),
        },
    )

