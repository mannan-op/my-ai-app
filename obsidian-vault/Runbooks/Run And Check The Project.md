# Run And Check The Project

## Start Services

From the repo root:

```powershell
cd C:\Users\manna\my-ai-app
docker compose up --build
```

Expected services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- Model server: `http://localhost:8000`
- Postgres: `localhost:5432`

## Check API Health

```powershell
Invoke-RestMethod http://localhost:4000/health
```

Expected shape:

```json
{
  "service": "api",
  "status": "ok",
  "database": "ok"
}
```

## Check Model Server Health

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Expected shape:

```json
{
  "service": "model-server",
  "status": "ok",
  "environment": "development"
}
```

## Upload A PDF

Replace the file path with a real PDF:

```powershell
curl.exe -X POST http://localhost:4000/documents/upload `
  -F "file=@C:\path\to\your.pdf" `
  -F "ticker=AAPL" `
  -F "companyName=Apple Inc." `
  -F "filingType=10-K"
```

Save the returned `id`.

## Extract Chunks

```powershell
Invoke-RestMethod -Method POST http://localhost:4000/documents/1/extract
```

This calls the model server, stores chunks, and generates embeddings.

## List Chunks

```powershell
Invoke-RestMethod http://localhost:4000/documents/1/chunks
```

Filter by page:

```powershell
Invoke-RestMethod "http://localhost:4000/documents/1/chunks?page=5"
```

Filter by type:

```powershell
Invoke-RestMethod "http://localhost:4000/documents/1/chunks?type=table"
```

## Run Hybrid Retrieval

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

If there are no table results, remove `region_type` and retry.

## Run LangGraph Agent

```powershell
$body = @{
  document_id = "doc_1"
  question = "What was revenue growth?"
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:4000/agent/ask `
  -ContentType "application/json" `
  -Body $body
```

Expected output includes:

- `plan`
- `retrievedChunks`
- `extractedFacts`
- `calculations`
- `verification`
- `citations`
- `finalAnswer`
- `errors`

## Run Table QA

```powershell
$body = @{
  table = @(
    @{ Name = "Alice"; Age = "24" },
    @{ Name = "Bob"; Age = "31" }
  )
  question = "Who is older?"
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:8000/table/qa `
  -ContentType "application/json" `
  -Body $body
```

Expected shape:

```json
{
  "answer": "Bob"
}
```

## Run NLI Verification

```powershell
$body = @{
  premise = "Revenue increased by 10% in 2024."
  hypothesis = "The company had higher revenue in 2024."
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:8000/verify/nli `
  -ContentType "application/json" `
  -Body $body
```

Expected shape:

```json
{
  "label": "ENTAILMENT",
  "score": 0.97
}
```

## Run Section Classification

```powershell
$body = @{
  text = "The company faces liquidity and market risk."
  candidate_labels = @("risk factors", "financial statements", "business")
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:8000/classify/section `
  -ContentType "application/json" `
  -Body $body
```

Expected shape:

```json
{
  "label": "risk factors",
  "score": 0.93
}
```

## Run Image-Based QA

`/layout/document-qa` and `/vision/qa` expect `image_base64`.

```powershell
$imageBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\image.png"))

$body = @{
  image_base64 = $imageBase64
  question = "What is shown?"
} | ConvertTo-Json

Invoke-RestMethod -Method POST http://localhost:8000/vision/qa `
  -ContentType "application/json" `
  -Body $body
```

For document-layout questions, use the same body with:

```text
http://localhost:8000/layout/document-qa
```

## Run Tests

```powershell
pnpm --filter api test
pnpm --filter api build
```

Model server:

```powershell
cd C:\Users\manna\my-ai-app\apps\model-server
python -m pytest tests
```

Related notes:

- [[API/API Reference]]
- [[Workflows/Hybrid Retrieval Workflow]]
- [[Tests/Test Strategy]]
