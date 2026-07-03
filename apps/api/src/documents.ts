import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { pool } from "./db.js";

const documentStorageDir = path.resolve(
  process.env.DOCUMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "documents")
);

export type DocumentRecord = {
  id: number;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  filingType: string | null;
  ticker: string | null;
  companyName: string | null;
  source: string | null;
  createdAt: string;
};

type CreateDocumentInput = {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  filingType?: string;
  ticker?: string;
  companyName?: string;
  source?: string;
};

type DocumentRow = {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  mime_type: string;
  file_size: string | number;
  page_count: number;
  filing_type: string | null;
  ticker: string | null;
  company_name: string | null;
  source: string | null;
  created_at: Date;
};

export class InvalidPdfError extends Error {
  constructor() {
    super("Uploaded file is not a readable PDF");
  }
}

export function isPdfUpload(file: Express.Multer.File): boolean {
  const extension = path.extname(file.originalname).toLowerCase();
  return file.mimetype === "application/pdf" || extension === ".pdf";
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentRecord> {
  let pageCount: number;

  try {
    const pdf = await PDFDocument.load(input.buffer);
    pageCount = pdf.getPageCount();
  } catch {
    throw new InvalidPdfError();
  }

  await fs.mkdir(documentStorageDir, { recursive: true });

  const storedFilename = `${crypto.randomUUID()}.pdf`;
  const filePath = path.join(documentStorageDir, storedFilename);
  await fs.writeFile(filePath, input.buffer);

  try {
    const result = await pool.query<DocumentRow>(
      `
        INSERT INTO documents (
          original_filename,
          stored_filename,
          file_path,
          mime_type,
          file_size,
          page_count,
          filing_type,
          ticker,
          company_name,
          source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        input.originalFilename,
        storedFilename,
        filePath,
        input.mimeType,
        input.fileSize,
        pageCount,
        input.filingType || null,
        input.ticker || null,
        input.companyName || null,
        input.source || "manual_upload"
      ]
    );

    return mapDocumentRow(result.rows[0]);
  } catch (error) {
    await fs.rm(filePath, { force: true });
    throw error;
  }
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const result = await pool.query<DocumentRow>(
    "SELECT * FROM documents ORDER BY created_at DESC, id DESC"
  );

  return result.rows.map(mapDocumentRow);
}

export async function getDocument(id: number): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRow>("SELECT * FROM documents WHERE id = $1", [id]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapDocumentRow(result.rows[0]);
}

function mapDocumentRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    pageCount: row.page_count,
    filingType: row.filing_type,
    ticker: row.ticker,
    companyName: row.company_name,
    source: row.source,
    createdAt: row.created_at.toISOString()
  };
}
