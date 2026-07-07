import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "./documents.js";
import { DocumentNotFoundError, MissingPdfFileError } from "./pdfExtraction.js";

export class InvalidPageError extends Error {
  constructor() {
    super("Page number is out of range.");
    this.name = "InvalidPageError";
  }
}

export async function renderDocumentPage(
  documentId: number,
  pageNumber: number,
  scale = 2
): Promise<{ buffer: Buffer; pageWidth: number; pageHeight: number; renderScale: number }> {
  const document = await getDocument(documentId);

  if (!document) {
    throw new DocumentNotFoundError();
  }

  if (!Number.isInteger(pageNumber) || pageNumber <= 0 || pageNumber > document.pageCount) {
    throw new InvalidPageError();
  }

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await fs.readFile(document.filePath);
  } catch {
    throw new MissingPdfFileError();
  }

  const modelServerUrl = process.env.MODEL_SERVER_URL ?? "http://localhost:8000";
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });

  formData.append("file", blob, path.basename(document.filePath));

  const response = await fetch(
    `${modelServerUrl}/pdf/render-page?page=${pageNumber}&scale=${scale}`,
    {
      method: "POST",
      body: formData
    }
  );

  if (response.status === 400) {
    throw new InvalidPageError();
  }

  if (!response.ok) {
    throw new Error(`Page render failed with ${response.status}`);
  }

  const pageWidth = Number(response.headers.get("X-Page-Width") ?? "0");
  const pageHeight = Number(response.headers.get("X-Page-Height") ?? "0");
  const renderScale = Number(response.headers.get("X-Render-Scale") ?? String(scale));
  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    pageWidth,
    pageHeight,
    renderScale
  };
}
