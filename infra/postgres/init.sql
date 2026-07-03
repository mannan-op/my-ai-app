CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS health_check (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO health_check (status)
VALUES ('ok')
ON CONFLICT DO NOTHING;

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
);

CREATE INDEX IF NOT EXISTS documents_created_at_idx
ON documents (created_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('paragraph', 'table', 'footnote', 'header', 'footer')),
  content TEXT NOT NULL,
  bbox JSONB NOT NULL,
  order_index INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(384),
  embedding_model TEXT,
  embedding_created_at TIMESTAMPTZ,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_order_idx
ON document_chunks (document_id, order_index);

CREATE INDEX IF NOT EXISTS document_chunks_document_page_type_idx
ON document_chunks (document_id, page_number, chunk_type);

CREATE INDEX IF NOT EXISTS document_chunks_search_vector_idx
ON document_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;
