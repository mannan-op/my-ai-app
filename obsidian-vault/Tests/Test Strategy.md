# Test Strategy

## API Tests

Tests are in:

```text
apps/api/src/retrieval.test.ts
```

Run:

```powershell
pnpm --filter api test
```

Current retrieval tests cover:

- parsing valid requests
- rejecting invalid request bodies
- successful hybrid retrieval
- document ID filtering
- region type filtering
- empty result handling
- RRF ranking behavior

The retrieval tests mock the database pool. This keeps the retrieval logic testable without requiring a live Postgres container.

## API Build Check

Run:

```powershell
pnpm --filter api build
```

This validates TypeScript.

## Model Server Tests

Tests are in:

```text
apps/model-server/tests/test_pdf_extraction.py
apps/model-server/tests/test_model_endpoints.py
```

They cover:

- basic layout chunk extraction
- table extraction
- invalid PDF handling
- table QA valid request
- table QA invalid table
- table QA empty table
- table QA malformed request
- NLI entailment
- NLI contradiction
- NLI neutral
- NLI malformed request
- layout document QA valid image
- layout document QA invalid image
- vision QA valid image
- vision QA malformed request
- section classification default labels
- section classification custom labels
- section classification malformed request

Run:

```powershell
cd C:\Users\manna\my-ai-app\apps\model-server
python -m pytest tests
```

The model endpoint tests use fake model pipelines through the model registry, so they do not download model weights.

## Manual End-to-End Checks

Use [[Runbooks/Run And Check The Project]] to manually verify:

- services start
- health endpoints respond
- PDF upload works
- extraction works
- chunks are stored
- retrieval returns ranked chunks
