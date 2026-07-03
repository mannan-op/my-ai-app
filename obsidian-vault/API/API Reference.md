# API Reference

Base URL:

```text
http://localhost:4000
```

## Health

```http
GET /health
```

Returns API and database health.

## Documents

```http
POST /documents/upload
```

Uploads a PDF in multipart form field `file`.

Optional form fields:

- `filingType`
- `ticker`
- `companyName`
- `source`

Common errors:

- `missing_file`
- `invalid_file_type`
- `unreadable_pdf`
- `upload_error`

```http
GET /documents
```

Lists uploaded documents.

```http
GET /documents/:id
```

Gets one document by numeric ID.

```http
POST /documents/:id/extract
```

Extracts PDF regions, stores chunks, and generates embeddings.

Common errors:

- `document_not_found`
- `missing_pdf_file`
- `unreadable_pdf`
- `extraction_failed`

```http
GET /documents/:id/chunks
```

Lists chunks for a document.

Optional query params:

- `page`
- `type`

Allowed `type` values:

- `paragraph`
- `table`
- `footnote`
- `header`
- `footer`

## Retrieval

```http
POST /retrieval/search
```

Runs hybrid retrieval.

Request:

```json
{
  "document_id": "doc_1",
  "query": "R&D expense 2024 revenue",
  "region_type": "table",
  "top_k": 8
}
```

Notes:

- `document_id` is required.
- `document_id` can be numeric, `"1"`, or `"doc_1"`.
- `query` is required and must not be empty.
- `region_type` is optional.
- `top_k` defaults to `8` and must be between `1` and `50`.

Response:

```json
{
  "chunks": [
    {
      "chunk_id": "chunk_1",
      "document_id": "doc_1",
      "content": "...",
      "page_number": 54,
      "bbox": [80, 220, 540, 430],
      "region_type": "table",
      "score": 1
    }
  ]
}
```

Related notes:

- [[Workflows/Hybrid Retrieval Workflow]]
- [[Glossary/Retrieval Glossary]]

## Model Server Inference APIs

Base URL:

```text
http://localhost:8000
```

### Table QA

```http
POST /table/qa
```

Answers a question about a structured table.

Request:

```json
{
  "table": [
    {
      "Name": "Alice",
      "Age": "24"
    },
    {
      "Name": "Bob",
      "Age": "31"
    }
  ],
  "question": "Who is older?"
}
```

Response:

```json
{
  "answer": "Bob"
}
```

### NLI Verification

```http
POST /verify/nli
```

Verifies whether evidence supports a claim.

Request:

```json
{
  "premise": "Revenue increased by 10% in 2024.",
  "hypothesis": "The company had higher revenue in 2024."
}
```

Response:

```json
{
  "label": "ENTAILMENT",
  "score": 0.97
}
```

Related note: [[Workflows/Model Server Inference Workflow]]
