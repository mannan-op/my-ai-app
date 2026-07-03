import { pool } from "./db.js";
import { embeddingToSqlVector, generateEmbeddings, getEmbeddingModelName } from "./embeddings.js";

export type ChunkType = "paragraph" | "table" | "footnote" | "header" | "footer";

export type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type DocumentChunk = {
  id: number;
  documentId: number;
  pageNumber: number;
  chunkType: ChunkType;
  content: string;
  bbox: BBox;
  orderIndex: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type NewDocumentChunk = Omit<DocumentChunk, "id" | "createdAt" | "updatedAt">;

type ChunkRow = {
  id: number;
  document_id: number;
  page_number: number;
  chunk_type: ChunkType;
  content: string;
  bbox: BBox;
  order_index: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export async function replaceDocumentChunks(
  documentId: number,
  chunks: NewDocumentChunk[]
): Promise<DocumentChunk[]> {
  const client = await pool.connect();
  const embeddings = await generateEmbeddings(chunks.map((chunk) => chunk.content));
  const embeddingModel = getEmbeddingModelName();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM document_chunks WHERE document_id = $1", [documentId]);

    const savedChunks: DocumentChunk[] = [];

    for (const [index, chunk] of chunks.entries()) {
      const result = await client.query<ChunkRow>(
        `
          INSERT INTO document_chunks (
            document_id,
            page_number,
            chunk_type,
            content,
            bbox,
            order_index,
            metadata,
            embedding,
            embedding_model,
            embedding_created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, NOW())
          RETURNING *
        `,
        [
          chunk.documentId,
          chunk.pageNumber,
          chunk.chunkType,
          chunk.content,
          JSON.stringify(chunk.bbox),
          chunk.orderIndex,
          JSON.stringify(chunk.metadata),
          embeddingToSqlVector(embeddings[index]),
          embeddingModel
        ]
      );

      savedChunks.push(mapChunkRow(result.rows[0]));
    }

    await client.query("COMMIT");
    return savedChunks;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listDocumentChunks(
  documentId: number,
  filters: { page?: number; type?: ChunkType }
): Promise<DocumentChunk[]> {
  const values: unknown[] = [documentId];
  const clauses = ["document_id = $1"];

  if (filters.page !== undefined) {
    values.push(filters.page);
    clauses.push(`page_number = $${values.length}`);
  }

  if (filters.type !== undefined) {
    values.push(filters.type);
    clauses.push(`chunk_type = $${values.length}`);
  }

  const result = await pool.query<ChunkRow>(
    `
      SELECT *
      FROM document_chunks
      WHERE ${clauses.join(" AND ")}
      ORDER BY order_index ASC, id ASC
    `,
    values
  );

  return result.rows.map(mapChunkRow);
}

export function isChunkType(value: unknown): value is ChunkType {
  return (
    value === "paragraph" ||
    value === "table" ||
    value === "footnote" ||
    value === "header" ||
    value === "footer"
  );
}

function mapChunkRow(row: ChunkRow): DocumentChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    pageNumber: row.page_number,
    chunkType: row.chunk_type,
    content: row.content,
    bbox: row.bbox,
    orderIndex: row.order_index,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}
