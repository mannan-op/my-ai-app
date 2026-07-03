# Database Schema

Postgres is initialized from `infra/postgres/init.sql` and checked at API startup by `ensureDatabaseSchema()` in `apps/api/src/db.ts`.

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The `vector` extension comes from pgvector and enables dense embedding search.

## documents

Stores metadata for uploaded PDFs.

Important columns:

- `id`
- `original_filename`
- `stored_filename`
- `file_path`
- `mime_type`
- `file_size`
- `page_count`
- `filing_type`
- `ticker`
- `company_name`
- `source`
- `created_at`

Indexes:

- `documents_created_at_idx`

## document_chunks

Stores extracted layout-aware regions.

Important columns:

- `id`
- `document_id`
- `page_number`
- `chunk_type`
- `content`
- `bbox`
- `order_index`
- `metadata`
- `embedding`
- `embedding_model`
- `embedding_created_at`
- `search_vector`
- `created_at`
- `updated_at`

Allowed `chunk_type` values:

- `paragraph`
- `table`
- `footnote`
- `header`
- `footer`

## Retrieval Columns

### embedding

Type:

```sql
vector(384)
```

Used by pgvector cosine search.

### search_vector

Type:

```sql
tsvector
```

Generated from chunk content:

```sql
to_tsvector('english', content)
```

Used by Postgres full-text search.

## Indexes

```sql
CREATE INDEX document_chunks_document_id_order_idx
ON document_chunks (document_id, order_index);
```

```sql
CREATE INDEX document_chunks_document_page_type_idx
ON document_chunks (document_id, page_number, chunk_type);
```

```sql
CREATE INDEX document_chunks_search_vector_idx
ON document_chunks USING GIN (search_vector);
```

```sql
CREATE INDEX document_chunks_embedding_idx
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;
```

Related notes:

- [[Workflows/Hybrid Retrieval Workflow]]
- [[Milestones/Milestone 4 - Hybrid Retrieval]]

