# Milestone Timeline

## Milestone 1 - Project Setup

Set up:

- Next.js frontend
- Node.js API
- FastAPI model server
- Postgres with pgvector
- Docker Compose
- shared environment config

## Milestone 3 - PDF Extraction And Chunk Storage

Implemented:

- PDF upload route
- PDF validation
- document metadata storage
- Python extraction service
- table/text extraction
- region classification
- chunk storage

See [[Workflows/PDF Extraction Workflow]].

## Milestone 4 - Hybrid Retrieval

Implemented:

- chunk embeddings
- query embeddings
- pgvector semantic search
- Postgres full-text search
- BM25-like ranking with `ts_rank_cd`
- RRF fusion
- metadata filters
- `/retrieval/search`
- retrieval tests

See [[Milestones/Milestone 4 - Hybrid Retrieval]].

## Milestone 5 - Model Server

Implemented Phase 1 MVP:

- TAPAS-style table question answering endpoint
- NLI verification endpoint
- centralized model registry
- model-server configuration layer
- route/schema/service separation
- structured JSON logging
- endpoint tests with fake pipelines

See [[Milestones/Milestone 5 - Model Server]].
