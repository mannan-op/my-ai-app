import express from "express";
import multer from "multer";
import {
  createDocument,
  getDocument,
  InvalidPdfError,
  isPdfUpload,
  listDocuments
} from "./documents.js";
import { isChunkType, listDocumentChunks } from "./documentChunks.js";
import {
  DocumentNotFoundError,
  ExtractionFailedError,
  extractAndStoreDocumentChunks,
  MissingPdfFileError,
  UnreadablePdfError
} from "./pdfExtraction.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

export const documentRouter = express.Router();

documentRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: "missing_file",
        message: "A PDF file must be uploaded in the 'file' form field."
      });
      return;
    }

    if (!isPdfUpload(req.file)) {
      res.status(400).json({
        error: "invalid_file_type",
        message: "Only PDF uploads are supported."
      });
      return;
    }

    const document = await createDocument({
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype || "application/pdf",
      fileSize: req.file.size,
      buffer: req.file.buffer,
      filingType: stringField(req.body.filingType),
      ticker: stringField(req.body.ticker),
      companyName: stringField(req.body.companyName),
      source: stringField(req.body.source)
    });

    res.status(201).json(document);
  } catch (error) {
    if (error instanceof InvalidPdfError) {
      res.status(400).json({
        error: "unreadable_pdf",
        message: "The uploaded file could not be read as a PDF."
      });
      return;
    }

    throw error;
  }
});

documentRouter.get("/", async (_req, res) => {
  const documents = await listDocuments();
  res.json(documents);
});

documentRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({
      error: "document_not_found",
      message: "Document not found."
    });
    return;
  }

  const document = await getDocument(id);

  if (!document) {
    res.status(404).json({
      error: "document_not_found",
      message: "Document not found."
    });
    return;
  }

  res.json(document);
});

documentRouter.post("/:id/extract", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({
      error: "document_not_found",
      message: "Document not found."
    });
    return;
  }

  try {
    const summary = await extractAndStoreDocumentChunks(id);
    res.json(summary);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) {
      res.status(404).json({
        error: "document_not_found",
        message: "Document not found."
      });
      return;
    }

    if (error instanceof MissingPdfFileError) {
      res.status(404).json({
        error: "missing_pdf_file",
        message: "The stored PDF file could not be found."
      });
      return;
    }

    if (error instanceof UnreadablePdfError) {
      res.status(400).json({
        error: "unreadable_pdf",
        message: "The stored file could not be read as a PDF."
      });
      return;
    }

    if (error instanceof ExtractionFailedError) {
      res.status(502).json({
        error: "extraction_failed",
        message: error.message
      });
      return;
    }

    throw error;
  }
});

documentRouter.get("/:id/chunks", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({
      error: "document_not_found",
      message: "Document not found."
    });
    return;
  }

  const document = await getDocument(id);

  if (!document) {
    res.status(404).json({
      error: "document_not_found",
      message: "Document not found."
    });
    return;
  }

  const page = req.query.page === undefined ? undefined : Number(req.query.page);

  if (page !== undefined && (!Number.isInteger(page) || page <= 0)) {
    res.status(400).json({
      error: "invalid_page",
      message: "Page must be a positive integer."
    });
    return;
  }

  if (req.query.type !== undefined && !isChunkType(req.query.type)) {
    res.status(400).json({
      error: "invalid_chunk_type",
      message: "Chunk type must be paragraph, table, footnote, header, or footer."
    });
    return;
  }

  const chunks = await listDocumentChunks(id, {
    page,
    type: req.query.type
  });

  res.json(chunks);
});

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
