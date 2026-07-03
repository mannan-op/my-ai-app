# Environment Variables

Configured in `.env` and documented in `.env.example`.

## App

```env
APP_ENV=development
```

## Postgres

```env
POSTGRES_USER=db_user
POSTGRES_PASSWORD=db_pass
POSTGRES_DB=app_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://db_user:db_pass@postgres:5432/app_db
```

When running outside Docker, the host in `DATABASE_URL` may need to be `localhost` instead of `postgres`.

## API

```env
API_PORT=4000
```

## Web

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Model Server

```env
MODEL_SERVER_URL=http://model-server:8000
```

Inside Docker, `model-server` is the Compose service name.

Outside Docker, use:

```env
MODEL_SERVER_URL=http://localhost:8000
```

## Model Server Inference

```env
MODEL_DEVICE=auto
MODEL_CACHE_DIR=
MODEL_BATCH_SIZE=1
MODEL_MAX_SEQUENCE_LENGTH=512
MODEL_PRELOAD=false
TAPAS_MODEL_NAME=google/tapas-base-finetuned-wtq
NLI_MODEL_NAME=cross-encoder/nli-deberta-v3-small
```

Notes:

- `MODEL_DEVICE=auto` uses GPU when available and CPU otherwise.
- `MODEL_PRELOAD=false` keeps startup light and loads models lazily on first request.
- `MODEL_CACHE_DIR` can point at a persistent Hugging Face model cache.

## Embeddings

Default local provider:

```env
EMBEDDING_PROVIDER=deterministic
EMBEDDING_MODEL=deterministic-hash-v1
EMBEDDING_DIMENSIONS=384
```

OpenAI provider:

```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=384
```

Important: the embedding dimension must match the database vector dimension.
