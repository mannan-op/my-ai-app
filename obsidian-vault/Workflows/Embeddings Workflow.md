# Embeddings Workflow

Embeddings are numeric vectors that represent chunk or query text.

## Where Embeddings Are Generated

File: `apps/api/src/embeddings.ts`

Functions:

- `generateEmbedding(text)`
- `generateEmbeddings(texts)`
- `embeddingToSqlVector(embedding)`

## Chunk Embeddings

Chunk embeddings are generated in `replaceDocumentChunks()` in:

```text
apps/api/src/documentChunks.ts
```

When extraction creates chunks, the API:

1. takes each chunk content
2. generates an embedding
3. inserts the embedding into Postgres
4. stores the embedding model name
5. stores `embedding_created_at`

## Query Embeddings

Query embeddings are generated in:

```text
apps/api/src/retrieval.ts
```

The query embedding is used for semantic search.

## Providers

### Deterministic Provider

Default provider.

Purpose:

- local development
- testability
- no external API key required

It hashes tokens into a fixed-size vector. This is useful for testing the pipeline, but it is not as semantically strong as a real embedding model.

### OpenAI Provider

Enabled with:

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=384
```

Related notes:

- [[Workflows/Hybrid Retrieval Workflow]]
- [[Database/Database Schema]]

