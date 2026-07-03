# End-to-End Document Workflow

This is the main data flow from upload to retrieval.

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant Disk
  participant DB as Postgres
  participant Model as Model Server

  Client->>API: POST /documents/upload
  API->>API: Validate file and PDF readability
  API->>Disk: Store PDF
  API->>DB: Insert document metadata
  API-->>Client: Document record

  Client->>API: POST /documents/:id/extract
  API->>Disk: Read stored PDF
  API->>Model: POST /pdf/extract
  Model-->>API: Extracted chunks
  API->>API: Generate embeddings
  API->>DB: Replace chunks and store embeddings
  API-->>Client: Extraction summary

  Client->>API: POST /retrieval/search
  API->>API: Generate query embedding
  API->>DB: Vector search
  API->>DB: Full-text search
  API->>API: RRF fusion
  API-->>Client: Ranked chunks
```

## Steps

1. Upload PDF.
2. Validate PDF and store file.
3. Insert document metadata.
4. Trigger extraction.
5. Extract regions using the model server.
6. Store chunks with embeddings.
7. Search chunks using hybrid retrieval.

Related notes:

- [[Workflows/PDF Extraction Workflow]]
- [[Workflows/Hybrid Retrieval Workflow]]
- [[API/API Reference]]

