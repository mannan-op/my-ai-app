import fs from "node:fs/promises";
import path from "node:path";
import { getDocument } from "./documents.js";
import {
  ChunkType,
  isChunkType,
  NewDocumentChunk,
  replaceDocumentChunks
} from "./documentChunks.js";

type ExtractorChunk = {
  pageNumber: number;
  chunkType: ChunkType;
  content: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  orderIndex: number;
  metadata: Record<string, unknown>;
};

type ExtractorResult = {
  totalPagesProcessed: number;
  chunks: ExtractorChunk[];
  errors: Array<{
    pageNumber: number;
    message: string;
  }>;
};

export class DocumentNotFoundError extends Error {
  constructor() {
    super("Document not found");
  }
}

export class MissingPdfFileError extends Error {
  constructor() {
    super("Stored PDF file is missing");
  }
}

export class UnreadablePdfError extends Error {
  constructor() {
    super("Stored PDF could not be read");
  }
}

export class ExtractionFailedError extends Error {
  constructor(message = "PDF region extraction failed") {
    super(message);
  }
}

export async function extractAndStoreDocumentChunks(documentId: number) {
  const document = await getDocument(documentId);

  if (!document) {
    throw new DocumentNotFoundError();
  }

  try {
    await fs.access(document.filePath);
  } catch {
    throw new MissingPdfFileError();
  }

  const pdfBuffer = await fs.readFile(document.filePath);
  const extraction = await callExtractor(pdfBuffer, document.originalFilename);

  const chunks: NewDocumentChunk[] = extraction.chunks.map((chunk) => ({
    documentId,
    pageNumber: chunk.pageNumber,
    chunkType: chunk.chunkType,
    content: chunk.content,
    bbox: chunk.bbox,
    orderIndex: chunk.orderIndex,
    metadata: chunk.metadata
  }));

  const savedChunks = await replaceDocumentChunks(documentId, chunks);
  const countByType = savedChunks.reduce<Record<ChunkType, number>>(
    (counts, chunk) => {
      counts[chunk.chunkType] += 1;
      return counts;
    },
    {
      paragraph: 0,
      table: 0,
      footnote: 0,
      header: 0,
      footer: 0
    }
  );

  return {
    documentId,
    totalPagesProcessed: extraction.totalPagesProcessed,
    totalChunksCreated: savedChunks.length,
    countByType,
    errors: extraction.errors
  };
}

async function callExtractor(pdfBuffer: Buffer, filename: string): Promise<ExtractorResult> {
  const modelServerUrl = process.env.MODEL_SERVER_URL ?? "http://localhost:8000";
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });

  formData.append("file", blob, path.basename(filename));

  const response = await fetch(`${modelServerUrl}/pdf/extract`, {
    method: "POST",
    body: formData
  });

  if (response.status === 400) {
    throw new UnreadablePdfError();
  }

  if (!response.ok) {
    throw new ExtractionFailedError(`Extractor returned ${response.status}`);
  }

  const result = (await response.json()) as ExtractorResult;

  if (!Array.isArray(result.chunks)) {
    throw new ExtractionFailedError("Extractor returned an invalid response");
  }

  for (const chunk of result.chunks) {
    if (!isChunkType(chunk.chunkType)) {
      throw new ExtractionFailedError(`Extractor returned invalid chunk type '${chunk.chunkType}'`);
    }
  }

  return result;
}
