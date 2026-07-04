# My AI App

A document AI application for PDF ingestion, layout-aware extraction, hybrid retrieval, and model-server inference.

The project is a monorepo with:

- Next.js frontend
- Node.js Express API
- Python FastAPI model server
- Postgres with pgvector
- Docker Compose local runtime
- Obsidian documentation vault

## Current Capabilities

- Upload PDF documents.
- Extract PDF regions into chunks:
  - `paragraph`
  - `table`
  - `footnote`
  - `header`
  - `footer`
- Store document metadata and chunks in Postgres.
- Generate and store chunk embeddings with pgvector.
- Search chunks with hybrid retrieval:
  - semantic vector search
  - Postgres full-text search
  - BM25-like `ts_rank_cd` scoring
  - Reciprocal Rank Fusion
- Run a LangGraph agent over retrieved evidence:
  - planning
  - retrieval
  - deterministic numeric analysis
  - verification
  - citation construction
  - final markdown answer generation
- Run Milestone 7 evaluation and observability:
  - golden dataset benchmarks
  - retrieval/answer/citation/numeric metrics
  - latency + cost reporting
  - stage-level telemetry and optional Langfuse traces
- Run model-server inference:
  - table question answering
  - NLI verification
  - layout-aware document question answering
  - vision question answering
  - document section classification

## Services

| Service | Path | URL |
| --- | --- | --- |
| Web | `apps/web` | `http://localhost:3000` |
| API | `apps/api` | `http://localhost:4000` |
| Model server | `apps/model-server` | `http://localhost:8000` |
| Postgres | `infra/postgres` | `localhost:5432` |

## Run With Docker

Create `.env` if needed:

```powershell
Copy-Item .env.example .env
```

Start everything:

```powershell
docker compose up --build
```

Or use the package script:

```powershell
pnpm docker:up
```

Stop services:

```powershell
pnpm docker:down
```

## Health Checks

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:8000/health
```

## API Workflow

### 1. Upload A PDF

```powershell
curl.exe -X POST http://localhost:4000/documents/upload `
  -F "file=@C:\path\to\your.pdf" `
  -F "ticker=AAPL" `
  -F "companyName=Apple Inc." `
  -F "filingType=10-K"
```

### 2. Extract Chunks

Use the returned document ID:

```powershell
Invoke-RestMethod -Method POST http://localhost:4000/documents/1/extract
```

This extracts regions, stores chunks, and generates embeddings.

### 3. List Chunks

```powershell
Invoke-RestMethod http://localhost:4000/documents/1/chunks
```

Optional filters:

```powershell
Invoke-RestMethod "http://localhost:4000/documents/1/chunks?page=5"
Invoke-RestMethod "http://localhost:4000/documents/1/chunks?type=table"
```

### 4. Hybrid Retrieval

```powershell
$body = @{
  document_id = "doc_1"
  query = "R&D expense 2024 revenue"
  region_type = "table"
  top_k = 8
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:4000/retrieval/search `
  -ContentType "application/json" `
  -Body $body
```

### 5. LangGraph Agent Answer

```powershell
$body = @{
  document_id = "doc_1"
  question = "What was revenue growth?"
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:4000/agent/ask `
  -ContentType "application/json" `
  -Body $body
```

The agent returns the final state, including the plan, retrieved chunks, extracted facts, calculations, verification result, structured citations, and final markdown answer.

Optional evaluation parameters:

```json
{
  "top_k": 10,
  "question_id": "test_001",
  "evaluation_id": "eval_2026_07_05",
  "save_traces": true
}
```

### 6. Run Evaluation

```powershell
python -m evaluation.evaluator
```

Outputs:

- `evaluation/results.json`
- `evaluation/report.md`

## Model Server Endpoints

### Table QA

```powershell
curl.exe -X POST http://localhost:8000/table/qa `
  -H "Content-Type: application/json" `
  -d "{\"table\":[{\"Name\":\"Alice\",\"Age\":\"24\"},{\"Name\":\"Bob\",\"Age\":\"31\"}],\"question\":\"Who is older?\"}"
```

Response:

```json
{
  "answer": "Bob"
}
```

### NLI Verification

```powershell
curl.exe -X POST http://localhost:8000/verify/nli `
  -H "Content-Type: application/json" `
  -d "{\"premise\":\"Revenue increased by 10% in 2024.\",\"hypothesis\":\"The company had higher revenue in 2024.\"}"
```

Response:

```json
{
  "label": "ENTAILMENT",
  "score": 0.97
}
```

### Layout Document QA

Accepts a base64-encoded document image and a question.

```powershell
curl.exe -X POST http://localhost:8000/layout/document-qa `
  -H "Content-Type: application/json" `
  -d "{\"image_base64\":\"<base64-png-or-jpeg>\",\"question\":\"What is the total revenue?\"}"
```

### Vision QA

Accepts a base64-encoded image and a question.

```powershell
curl.exe -X POST http://localhost:8000/vision/qa `
  -H "Content-Type: application/json" `
  -d "{\"image_base64\":\"<base64-png-or-jpeg>\",\"question\":\"What is shown in the image?\"}"
```

### Section Classification

```powershell
curl.exe -X POST http://localhost:8000/classify/section `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"The company faces liquidity and market risk.\",\"candidate_labels\":[\"risk factors\",\"financial statements\",\"business\"]}"
```

## Important Endpoints

### API

- `GET /health`
- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id`
- `POST /documents/:id/extract`
- `GET /documents/:id/chunks`
- `POST /retrieval/search`
- `POST /agent/ask`

### Model Server

- `GET /health`
- `POST /pdf/extract`
- `POST /table/qa`
- `POST /verify/nli`
- `POST /layout/document-qa`
- `POST /vision/qa`
- `POST /classify/section`

## Environment Variables

See `.env.example` for the full list.

Key groups:

- Postgres:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
  - `POSTGRES_PORT`
  - `DATABASE_URL`
- API:
  - `API_PORT`
  - `MODEL_SERVER_URL`
- Retrieval embeddings:
  - `EMBEDDING_PROVIDER`
  - `EMBEDDING_MODEL`
  - `EMBEDDING_DIMENSIONS`
  - `OPENAI_API_KEY`
  - `OPENAI_EMBEDDING_MODEL`
- Model server:
  - `MODEL_DEVICE`
  - `MODEL_CACHE_DIR`
  - `MODEL_BATCH_SIZE`
  - `MODEL_MAX_SEQUENCE_LENGTH`
  - `MODEL_PRELOAD`
  - `TAPAS_MODEL_NAME`
  - `NLI_MODEL_NAME`
  - `LAYOUT_DOCUMENT_QA_MODEL_NAME`
  - `VISION_QA_MODEL_NAME`
  - `SECTION_CLASSIFIER_MODEL_NAME`

## Tests

API:

```powershell
pnpm --filter api test
pnpm --filter api build
python -m pytest evaluation/tests -q
```

Model server:

```powershell
cd apps/model-server
python -m pytest tests
python -m compileall app
```

## Documentation

The Obsidian vault is in:

```text
obsidian-vault
```

Open that folder in Obsidian and start with:

```text
Home.md
```

Useful notes:

- `Project Overview`
- `Architecture/System Architecture`
- `Workflows/End-to-End Document Workflow`
- `Workflows/Hybrid Retrieval Workflow`
- `Workflows/Model Server Inference Workflow`
- `API/API Reference`
- `Milestones/Milestone 5 - Model Server`
- `Milestones/Milestone 6 - LangGraph Agent System`
- `Milestones/Milestone 7 - Evaluation`
- `Evaluation/Evaluation Pipeline`
- `Evaluation/Metrics`
- `Evaluation/Langfuse Observability`

## Milestones So Far

- Milestone 1: project setup
- Milestone 3: PDF extraction and chunk storage
- Milestone 4: hybrid retrieval
- Milestone 5: model-server table QA, NLI, layout document QA, vision QA, and section classification
- Milestone 6: LangGraph agent system for planned, verified, cited answers
- Milestone 7: evaluation framework with quality metrics and stage observability
