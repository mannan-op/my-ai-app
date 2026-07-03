# Milestone 4 - Hybrid Retrieval

## Goal

Allow a user to ask a question and retrieve the best matching document chunks.

## Implemented

### Embedding Generation

Implemented in:

```text
apps/api/src/embeddings.ts
```

Chunk embeddings are generated when chunks are saved.

Query embeddings are generated during search.

### pgvector Storage

Implemented in:

```text
apps/api/src/db.ts
infra/postgres/init.sql
```

Chunk embeddings are stored on `document_chunks.embedding`.

### Full-Text Search

`document_chunks.search_vector` is a generated `tsvector` column from `content`.

Search uses:

```sql
websearch_to_tsquery('english', query)
```

### BM25-like Ranking

Keyword ranking uses:

```sql
ts_rank_cd(search_vector, query, 32)
```

This is Postgres full-text ranking. It is BM25-like, but not a custom BM25 implementation.

### RRF Fusion

Implemented in:

```text
apps/api/src/retrieval.ts
```

Vector and keyword result lists are fused by rank:

```text
1 / (60 + rank)
```

### Metadata Filters

Supported:

- `document_id`
- `region_type`

### API Route

```http
POST /retrieval/search
```

Implemented in:

```text
apps/api/src/retrievalRoutes.ts
```

## Tests

Implemented in:

```text
apps/api/src/retrieval.test.ts
```

Covered:

- successful hybrid retrieval
- document ID filtering
- region type filtering
- empty result handling
- invalid request body
- ranking/fusion behavior

Related notes:

- [[Workflows/Hybrid Retrieval Workflow]]
- [[Workflows/Embeddings Workflow]]
- [[Database/Database Schema]]

