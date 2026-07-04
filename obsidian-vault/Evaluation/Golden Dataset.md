# Golden Dataset

Dataset file:

```text
evaluation/golden_dataset.jsonl
```

## Schema

Each line is one JSON object:

```json
{
  "id": "test_001",
  "document_id": "doc_1",
  "question": "What was iPhone net sales in 2024?",
  "expected_answer": "201.183 billion",
  "required_chunk_ids": ["chunk_101"],
  "required_page": 47,
  "answer_type": "table_cell"
}
```

## Supported Answer Types

- `table_cell`
- `paragraph`
- `calculation`
- `ratio`
- `comparison`
- `date`
- `yes_no`
- `citation_only`
- `footnote`

## Coverage Goals

The current set covers:

- financial statement tables
- MD&A-like narrative questions
- note/footnote questions
- cross-chunk calculations
- comparison and ratio prompts
- numeric normalization stress cases
- citation page checks

## Adding New Benchmark Questions

1. Append one JSON object per line in `evaluation/golden_dataset.jsonl`.
2. Keep IDs stable and unique.
3. Include required chunks and page for retrieval/citation scoring.
4. Choose the closest `answer_type`.

## Validation Rules

- `required_chunk_ids` should reference chunk IDs the retriever is expected to return.
- `required_page` should match source evidence page.
- `expected_answer` should include explicit units when numeric.

Related:

- [[Evaluation/Evaluation Pipeline]]
- [[Evaluation/Metrics]]

