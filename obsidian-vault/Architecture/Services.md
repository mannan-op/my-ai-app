# Services

## Web

Path: `apps/web`

Framework: Next.js

Local URL:

```text
http://localhost:3000
```

Current behavior:

- Displays a simple status page.
- Does not yet provide PDF upload, document browsing, or retrieval UI.

## API

Path: `apps/api`

Framework: Express

Local URL:

```text
http://localhost:4000
```

Responsibilities:

- Health endpoint
- PDF upload
- Document metadata storage
- Calls Python model server for extraction
- Stores extracted chunks
- Generates chunk embeddings
- Executes hybrid retrieval
- Runs the LangGraph answer agent

Important files:

- `apps/api/src/index.ts`
- `apps/api/src/documentRoutes.ts`
- `apps/api/src/documents.ts`
- `apps/api/src/documentChunks.ts`
- `apps/api/src/pdfExtraction.ts`
- `apps/api/src/retrieval.ts`
- `apps/api/src/embeddings.ts`
- `apps/api/src/agents/graph.ts`
- `apps/api/src/agents/index.ts`
- `apps/api/src/agentRoutes.ts`
- `apps/api/src/db.ts`

## Model Server

Path: `apps/model-server`

Framework: FastAPI

Local URL:

```text
http://localhost:8000
```

Responsibilities:

- Receives uploaded PDF bytes from the API.
- Extracts document regions.
- Returns chunks with page number, region type, text, bounding box, order index, and metadata.
- Exposes inference endpoints for table QA, NLI verification, layout document QA, vision QA, and section classification.
- Lazily loads reusable model pipelines through a model registry.

Important files:

- `apps/model-server/app/main.py`
- `apps/model-server/app/pdf_extraction.py`
- `apps/model-server/app/api/model_routes.py`
- `apps/model-server/app/models/registry.py`
- `apps/model-server/app/services/table_qa_service.py`
- `apps/model-server/app/services/nli_service.py`
- `apps/model-server/app/services/layout_document_qa_service.py`
- `apps/model-server/app/services/vision_qa_service.py`
- `apps/model-server/app/services/section_classifier_service.py`

## Postgres

Image: `pgvector/pgvector:pg18-trixie`

Local port:

```text
5432
```

Responsibilities:

- Stores document metadata.
- Stores extracted chunks.
- Stores pgvector embeddings.
- Stores generated full-text `tsvector` data.
- Supports semantic and keyword retrieval.

Related note: [[Database/Database Schema]]
