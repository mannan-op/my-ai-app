import io
import re
from collections import Counter
from statistics import median
from typing import Any, Literal

import fitz
import pdfplumber
from pydantic import BaseModel

ChunkType = Literal["paragraph", "table", "footnote", "header", "footer"]


class BBox(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class ExtractedChunk(BaseModel):
    pageNumber: int
    chunkType: ChunkType
    content: str
    bbox: BBox
    orderIndex: int
    metadata: dict[str, Any]


class PageExtractionError(BaseModel):
    pageNumber: int
    message: str


class ExtractionResult(BaseModel):
    totalPagesProcessed: int
    chunks: list[ExtractedChunk]
    errors: list[PageExtractionError]


def extract_pdf_regions(pdf_bytes: bytes) -> ExtractionResult:
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("invalid_pdf") from exc

    table_chunks_by_page = _extract_tables(pdf_bytes)
    text_blocks_by_page: dict[int, list[dict[str, Any]]] = {}
    top_texts: list[str] = []
    bottom_texts: list[str] = []
    font_sizes: list[float] = []
    errors: list[PageExtractionError] = []

    for page_index in range(document.page_count):
        page_number = page_index + 1
        try:
            page = document[page_index]
            _render_page(page)
            blocks = _extract_text_blocks(page)
            text_blocks_by_page[page_number] = blocks
            height = page.rect.height

            for block in blocks:
                font_sizes.append(block["fontSize"])
                normalized = _normalize_text(block["text"])
                if block["bbox"].y0 <= height * 0.12:
                    top_texts.append(normalized)
                if block["bbox"].y1 >= height * 0.88:
                    bottom_texts.append(normalized)
        except Exception as exc:
            errors.append(PageExtractionError(pageNumber=page_number, message=str(exc)))

    repeated_top = _repeated_texts(top_texts)
    repeated_bottom = _repeated_texts(bottom_texts)
    median_font_size = median(font_sizes) if font_sizes else 0

    chunks: list[ExtractedChunk] = []

    for page_index in range(document.page_count):
        page_number = page_index + 1
        page = document[page_index]
        page_tables = table_chunks_by_page.get(page_number, [])
        page_chunks: list[ExtractedChunk] = []

        page_chunks.extend(page_tables)

        for block in text_blocks_by_page.get(page_number, []):
            if _intersects_any(block["bbox"], [chunk.bbox for chunk in page_tables]):
                continue

            chunk_type = _classify_text_block(
                block=block,
                page_height=page.rect.height,
                repeated_top=repeated_top,
                repeated_bottom=repeated_bottom,
                median_font_size=median_font_size,
            )

            page_chunks.append(
                ExtractedChunk(
                    pageNumber=page_number,
                    chunkType=chunk_type,
                    content=block["text"],
                    bbox=block["bbox"],
                    orderIndex=0,
                    metadata={
                        "source": "pymupdf",
                        "averageFontSize": block["fontSize"],
                        "coordinateSystem": "PyMuPDF page coordinates with origin at top-left, in PDF points",
                    },
                )
            )

        page_chunks.sort(key=lambda chunk: (chunk.pageNumber, chunk.bbox.y0, chunk.bbox.x0))
        chunks.extend(page_chunks)

    for index, chunk in enumerate(chunks):
        chunk.orderIndex = index

    return ExtractionResult(
        totalPagesProcessed=document.page_count - len(errors),
        chunks=chunks,
        errors=errors,
    )


def _render_page(page: fitz.Page) -> bytes:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    return pixmap.tobytes("png")


def _extract_text_blocks(page: fitz.Page) -> list[dict[str, Any]]:
    raw = page.get_text("dict")
    blocks: list[dict[str, Any]] = []

    for block in raw.get("blocks", []):
        if block.get("type") != 0:
            continue

        lines: list[str] = []
        font_sizes: list[float] = []

        for line in block.get("lines", []):
            line_text = "".join(span.get("text", "") for span in line.get("spans", [])).strip()
            if line_text:
                lines.append(line_text)
            for span in line.get("spans", []):
                if span.get("text", "").strip():
                    font_sizes.append(float(span.get("size", 0)))

        text = "\n".join(lines).strip()
        if not text:
            continue

        x0, y0, x1, y1 = block["bbox"]
        blocks.append(
            {
                "text": text,
                "bbox": BBox(x0=x0, y0=y0, x1=x1, y1=y1),
                "fontSize": sum(font_sizes) / len(font_sizes) if font_sizes else 0,
            }
        )

    return blocks


def _extract_tables(pdf_bytes: bytes) -> dict[int, list[ExtractedChunk]]:
    tables_by_page: dict[int, list[ExtractedChunk]] = {}

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_index, page in enumerate(pdf.pages):
            page_number = page_index + 1
            tables_by_page[page_number] = []

            for table_index, table in enumerate(page.find_tables()):
                rows = table.extract()
                if not rows:
                    continue

                bbox = BBox(x0=table.bbox[0], y0=table.bbox[1], x1=table.bbox[2], y1=table.bbox[3])
                readable_rows = [
                    " | ".join("" if cell is None else str(cell).strip() for cell in row)
                    for row in rows
                ]

                tables_by_page[page_number].append(
                    ExtractedChunk(
                        pageNumber=page_number,
                        chunkType="table",
                        content="\n".join(readable_rows),
                        bbox=bbox,
                        orderIndex=0,
                        metadata={
                            "source": "pdfplumber",
                            "tableIndex": table_index,
                            "rows": rows,
                            "coordinateSystem": "pdfplumber page coordinates with origin at top-left, in PDF points",
                        },
                    )
                )

    return tables_by_page


def _classify_text_block(
    block: dict[str, Any],
    page_height: float,
    repeated_top: set[str],
    repeated_bottom: set[str],
    median_font_size: float,
) -> ChunkType:
    text = block["text"].strip()
    normalized = _normalize_text(text)
    bbox = block["bbox"]

    if bbox.y0 <= page_height * 0.10 or normalized in repeated_top:
        return "header"

    if bbox.y1 >= page_height * 0.90 or normalized in repeated_bottom or _looks_like_page_number(text):
        return "footer"

    if bbox.y0 >= page_height * 0.72 and (
        _looks_like_footnote(text) or (median_font_size > 0 and block["fontSize"] <= median_font_size * 0.85)
    ):
        return "footnote"

    return "paragraph"


def _repeated_texts(texts: list[str]) -> set[str]:
    return {text for text, count in Counter(texts).items() if text and count >= 2}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def _looks_like_page_number(text: str) -> bool:
    stripped = text.strip()
    return bool(re.fullmatch(r"(page\s*)?\d+(\s+of\s+\d+)?", stripped, flags=re.IGNORECASE))


def _looks_like_footnote(text: str) -> bool:
    return bool(re.match(r"^(\*+|\d+[\.\)]|[\u2020\u2021])\s+", text.strip()))


def _intersects_any(bbox: BBox, others: list[BBox]) -> bool:
    return any(_intersection_area(bbox, other) > 0 for other in others)


def _intersection_area(a: BBox, b: BBox) -> float:
    width = max(0, min(a.x1, b.x1) - max(a.x0, b.x0))
    height = max(0, min(a.y1, b.y1) - max(a.y0, b.y0))
    return width * height
