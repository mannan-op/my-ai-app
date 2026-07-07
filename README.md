# FillingLens

**FillingLens** is an analyst workspace for SEC filings and financial documents. Upload PDFs, extract layout-aware chunks, search with hybrid retrieval, and ask questions through a LangGraph agent that plans, retrieves evidence, runs numeric analysis, verifies claims, and returns cited markdown answers. A Python model server handles PDF extraction and specialized inference (table QA, NLI, layout/vision QA, section classification). An evaluation pipeline benchmarks retrieval, answer quality, citations, and latency against a golden dataset.

> **Naming note:** The product is branded **FillingLens** in this README. The codebase still uses **FilingLens** in several places (for example `FilingLensState` in the API agent and UI labels in `apps/web`).

## Architecture

The API coordinates the system: it owns public routes, persists metadata and chunks, calls the model server, and runs the LangGraph agent. Postgres with the **pgvector** extension stores relational data, embeddings, and full-text search indexes. The evaluation pipeline drives the agent through golden examples and writes benchmark reports.

```mermaid
flowchart TB
  User["Analyst / Client"]
  Web["Web — Next.js\nlocalhost:3000"]
  API["API — Express + LangGraph\nlocalhost:4000"]
  Model["Model Server — FastAPI\nlocalhost:8000"]
  DB[("Postgres + pgvector\nlocalhost:5432")]
  Disk["PDF storage\napps/api/storage"]
  Eval["Evaluation pipeline\nevaluation/"]

  User --> Web
  User --> API
  Web --> API
  API --> DB
  API --> Disk
  API --> Model
  Eval -->|"POST /agent/ask"| API
  Eval --> Results["results.json + report.md"]
```

## Monorepo structure

| Path | Role |
| --- | --- |
| `apps/web` | Next.js frontend — dashboard, document library, chat, evals UI |
| `apps/api` | Express API — uploads, extraction orchestration, hybrid retrieval, LangGraph agent |
| `apps/model-server` | FastAPI service — PDF layout extraction and ML inference endpoints |
| `evaluation/` | Golden-dataset benchmarks, metrics, and report generation |
| `infra/postgres` | Postgres bootstrap SQL (includes pgvector setup) |
| `config/` | Evaluation and runtime configuration |
| `obsidian-vault/` | Detailed architecture, workflows, and API reference |

## Prerequisites

- **Docker Desktop** (recommended) — runs Postgres, API, web, and model server together with correct networking
- **Node.js** 20+ and **pnpm** 9+ — local web/API development
- **Python** 3.11+ — running evaluation CLI and model-server tests locally

## Quick start

### Docker (recommended)

From the repo root:

```powershell
Copy-Item .env.example .env
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

Verify health:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod http://localhost:8000/health
```

Open the web app at [http://localhost:3000](http://localhost:3000).

### Local development

For faster iteration on the frontend and API, run Postgres and the model server via Docker, then start the Node apps locally:

```powershell
docker compose up postgres model-server
pnpm install
pnpm dev
```

`pnpm dev` runs `apps/web` and `apps/api` in parallel. When the API runs on the host, set `DATABASE_URL` to point at localhost (not the Docker service name `postgres`):

```env
DATABASE_URL=postgresql://app_usr:app_usr_pass@localhost:5432/app_db
MODEL_SERVER_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Environment setup

Copy the example env file and adjust as needed:

```powershell
Copy-Item .env.example .env
```

Key variables:

| Group | Variables | Notes |
| --- | --- | --- |
| Postgres | `POSTGRES_*`, `DATABASE_URL` | Must use a Postgres image with **pgvector** (see `docker-compose.yaml`) |
| API | `API_PORT`, `MODEL_SERVER_URL` | API defaults to port 4000 |
| Web | `NEXT_PUBLIC_API_URL` | Browser-facing API base URL |
| Embeddings | `EMBEDDING_PROVIDER`, `OPENAI_API_KEY` | Default is deterministic local embeddings; set `openai` for production-quality vectors |
| Model server | `MODEL_*`, `TAPAS_MODEL_NAME`, etc. | Hugging Face model names and device settings |
| Observability | `LANGFUSE_*` | Optional Langfuse tracing for agent stages |

See `.env.example` for the full list.

## Key URLs

| Service | URL |
| --- | --- |
| Web | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:4000](http://localhost:4000) |
| Model server | [http://localhost:8000](http://localhost:8000) |
| Postgres | `localhost:5432` |

Primary API routes: `GET /health`, `POST /documents/upload`, `POST /documents/:id/extract`, `POST /retrieval/search`, `POST /agent/ask`.

## Evaluation

Run the golden-dataset benchmark (requires the API to be reachable):

```powershell
python -m evaluation.evaluator
```

Outputs:

- `evaluation/results.json` — machine-readable metrics
- `evaluation/report.md` — human-readable summary

The eval UI at `/evals` reads results when services run under Docker Compose.

## Troubleshooting

**Web shows "failed to fetch" or network errors**

The API is not running, or `NEXT_PUBLIC_API_URL` does not match where the API listens. Confirm `http://localhost:4000/health` returns `"status": "ok"`.

**API health reports a database error**

Postgres is down or `DATABASE_URL` is wrong. Inside Docker, use the service hostname `postgres`. On the host, use `localhost`. Ensure you are using a **pgvector-enabled** Postgres image — plain Postgres will fail on embedding columns.

**Extraction fails**

The model server must be up at port 8000. Inside Docker, `MODEL_SERVER_URL` should be `http://model-server:8000`; on the host, use `http://localhost:8000`.

**Retrieval returns no chunks**

Upload a PDF, run extraction (`POST /documents/:id/extract`), then search. Try without a restrictive `region_type` filter. Re-extract if embeddings were generated before a provider change.

**OpenAI embeddings fail**

Set `EMBEDDING_PROVIDER=openai`, provide `OPENAI_API_KEY`, and match `EMBEDDING_DIMENSIONS` to the database vector size. For local testing, use `EMBEDDING_PROVIDER=deterministic`.

## Tests

```powershell
pnpm --filter api test
pnpm --filter api build
python -m pytest evaluation/tests -q

cd apps/model-server
python -m pytest tests
```

## Documentation

The Obsidian vault in `obsidian-vault/` has deeper coverage. Start with `Home.md`, then:

- `Project Overview`
- `Architecture/System Architecture`
- `Workflows/End-to-End Document Workflow`
- `Evaluation/Evaluation Pipeline`
- `Runbooks/Troubleshooting`
