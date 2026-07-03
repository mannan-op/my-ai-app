# Troubleshooting

## API Health Says Database Error

Check that Docker Compose started Postgres and the API has the correct `DATABASE_URL`.

Useful command:

```powershell
docker compose ps
```

## Retrieval Returns Empty Chunks

Possible causes:

- No document was uploaded.
- Extraction was not run.
- The document has no matching chunks.
- `region_type` is too restrictive.
- Embeddings are missing for older chunks.

Try searching without `region_type`:

```json
{
  "document_id": "doc_1",
  "query": "revenue expenses cash flow",
  "top_k": 8
}
```

## Upload Fails

Check:

- file is a PDF
- file is under 50 MB
- multipart field name is `file`

## Extraction Fails

Check:

- model server is running at `http://localhost:8000`
- `MODEL_SERVER_URL` is correct inside Docker
- stored PDF file still exists

## OpenAI Embeddings Fail

Check:

- `EMBEDDING_PROVIDER=openai`
- `OPENAI_API_KEY` is set
- model name is valid
- requested dimensions match the database vector dimension

For local testing, use:

```env
EMBEDDING_PROVIDER=deterministic
EMBEDDING_DIMENSIONS=384
```

