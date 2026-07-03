# Milestone 5 - Model Server

## Objective

Expose multimodal AI model capabilities through the FastAPI model server.

Phase 1 MVP implements:

- TAPAS-style table question answering
- NLI verification

## Implemented Endpoints

```http
POST /table/qa
POST /verify/nli
```

## Architecture

The model server now uses separate layers:

- API routes
- Pydantic schemas
- config
- structured logging
- model registry
- inference services

Files:

- `apps/model-server/app/api/model_routes.py`
- `apps/model-server/app/api/pdf_routes.py`
- `apps/model-server/app/core/config.py`
- `apps/model-server/app/core/logging.py`
- `apps/model-server/app/models/registry.py`
- `apps/model-server/app/schemas/inference.py`
- `apps/model-server/app/services/table_qa_service.py`
- `apps/model-server/app/services/nli_service.py`

## Model Registry

The model registry:

- lazy loads models
- keeps singleton pipeline instances
- selects CPU/GPU device
- supports future model expansion

Model preload can be enabled with:

```env
MODEL_PRELOAD=true
```

## Supported MVP Models

Table QA:

```env
TAPAS_MODEL_NAME=google/tapas-base-finetuned-wtq
```

NLI:

```env
NLI_MODEL_NAME=cross-encoder/nli-deberta-v3-small
```

## Configuration

```env
MODEL_DEVICE=auto
MODEL_CACHE_DIR=
MODEL_BATCH_SIZE=1
MODEL_MAX_SEQUENCE_LENGTH=512
MODEL_PRELOAD=false
TAPAS_MODEL_NAME=google/tapas-base-finetuned-wtq
NLI_MODEL_NAME=cross-encoder/nli-deberta-v3-small
```

## Future Expansion

The registry and route/service structure are ready for:

- LayoutLMv3 document QA
- vision-language QA
- section classification

Future endpoints:

```http
POST /layout/document-qa
POST /vision/qa
POST /classify/section
```

## Tests

Tests are in:

```text
apps/model-server/tests/test_model_endpoints.py
```

They use fake pipelines through the registry so tests do not download model weights.

Related notes:

- [[Workflows/Model Server Inference Workflow]]
- [[API/API Reference]]
- [[Environment Variables]]
- [[Tests/Test Strategy]]

