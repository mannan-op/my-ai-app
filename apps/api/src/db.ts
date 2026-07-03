import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export async function ensureDatabaseSchema(): Promise<void> {
  const embeddingDimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);

  if (!Number.isInteger(embeddingDimensions) || embeddingDimensions <= 0) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer");
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size BIGINT NOT NULL,
      page_count INTEGER NOT NULL,
      filing_type TEXT,
      ticker TEXT,
      company_name TEXT,
      source TEXT NOT NULL DEFAULT 'manual_upload',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS documents_created_at_idx
    ON documents (created_at DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      chunk_type TEXT NOT NULL CHECK (chunk_type IN ('paragraph', 'table', 'footnote', 'header', 'footer')),
      content TEXT NOT NULL,
      bbox JSONB NOT NULL,
      order_index INTEGER NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding vector(${embeddingDimensions})
  `);

  await pool.query(`
    ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding_model TEXT
  `);

  await pool.query(`
    ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS embedding_created_at TIMESTAMPTZ
  `);

  await pool.query(`
    ALTER TABLE document_chunks
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_chunks_document_id_order_idx
    ON document_chunks (document_id, order_index)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_chunks_document_page_type_idx
    ON document_chunks (document_id, page_number, chunk_type)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_chunks_search_vector_idx
    ON document_chunks USING GIN (search_vector)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    WHERE embedding IS NOT NULL
  `);
}
