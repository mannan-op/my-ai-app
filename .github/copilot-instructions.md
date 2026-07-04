# Copilot Instructions for `my-ai-app`

## Build, test, and lint commands

This repo is a pnpm workspace (`pnpm@11.9.0`) with Node services plus a Python model server.

### Workspace / service dev

```powershell
pnpm dev                 # run web + api in parallel
pnpm dev:web             # Next.js web only
pnpm dev:api             # Express API only
pnpm docker:up           # start postgres + api + web + model-server via Docker Compose
pnpm docker:down
```

### API (`apps/api`)

```powershell
pnpm --filter api build
pnpm --filter api test
```

Single test file:

```powershell
pnpm --filter api test -- src/retrieval.test.ts
```

Single test case:

```powershell
pnpm --filter api test -- src/retrieval.test.ts -t "parses string document IDs and defaults top_k"
```

### Web (`apps/web`)

```powershell
pnpm --filter web build
pnpm --filter web lint
```

### Model server (`apps/model-server`)

```powershell
cd apps/model-server
python -m pytest tests
python -m compileall app
```

Single test file:

```powershell
cd apps/model-server
python -m pytest tests/test_model_endpoints.py
```

Single test case:

```powershell
cd apps/model-server
python -m pytest tests/test_model_endpoints.py::test_table_qa_valid_table
```

## High-level architecture

- The monorepo runs 4 services: `apps/web` (Next.js), `apps/api` (Express + TypeScript), `apps/model-server` (FastAPI + transformers), and Postgres/pgvector (`docker-compose.yaml`).
- `apps/api/src/index.ts` is the API composition root. It mounts `/documents`, `/retrieval`, and `/agent`, runs `ensureDatabaseSchema()` on startup, and centralizes error translation.
- Document ingestion flow:
  1. `/documents/upload` stores PDF metadata + file on disk.
  2. `/documents/:id/extract` sends the PDF to model-server `/pdf/extract`.
  3. Extracted regions are stored as `document_chunks`, replacing prior chunks for that document.
  4. Embeddings are generated during chunk persistence.
- Retrieval flow (`apps/api/src/retrieval.ts`): vector similarity (pgvector) + Postgres full-text search are fused with Reciprocal Rank Fusion. External IDs are returned as `doc_<id>` / `chunk_<id>`.
- Agent flow (`apps/api/src/agents/graph.ts`) is a fixed LangGraph pipeline:
  `planner -> retriever -> numericAnalyst -> verifier -> citationBuilder -> finalAnswer`.
  Nodes operate on a shared typed state object.
- Model server flow (`apps/model-server/app/main.py`): FastAPI lifespan creates `ModelRegistry`; pipelines are lazily loaded on first request (or preloaded if `MODEL_PRELOAD=true`). API endpoints are in `app/api/model_routes.py` and `app/api/pdf_routes.py`.

## Key repository conventions

- Keep chunk/document type and ID conventions consistent:
  - Chunk types are a closed enum: `paragraph | table | footnote | header | footer`.
  - Retrieval and agent-facing IDs use `doc_<id>` and `chunk_<id>`; parsing accepts numeric IDs and prefixed IDs.
- API request/response shapes intentionally mix conventions by surface:
  - Agent/retrieval request fields use snake_case keys like `document_id`, `top_k`, `region_type`.
  - Many internal TypeScript types use camelCase and are mapped at boundaries.
- `replaceDocumentChunks` is transactional and regenerates embeddings for all chunks; preserve this all-or-replace behavior when changing extraction/storage.
- Agent nodes should use `runNode(...)` wrappers. Node failures are recorded in `state.errors` and graph execution continues, rather than hard-failing the whole request.
- Embeddings default to deterministic hashing unless `EMBEDDING_PROVIDER=openai`; do not assume OpenAI is always configured.
- Both API and model-server use structured JSON logging (not plain text logs); preserve structured fields when adding logs.
