# Retrieval Glossary

## Chunk

A document region extracted from a PDF page.

Examples:

- paragraph
- table
- header
- footer
- footnote

## Embedding

A numeric vector representation of text.

Used for semantic similarity search.

## Dense Retrieval

Retrieval using embeddings and vector similarity.

Good for meaning-based matches.

Weak when exact tokens matter, such as years, tickers, or financial line items.

## Keyword Retrieval

Retrieval using text terms.

Good for exact matches.

Weak when wording differs.

## pgvector

Postgres extension for vector storage and similarity search.

This project uses it for semantic retrieval over chunk embeddings.

## Full-Text Search

Postgres feature for searching text with `tsvector` and `tsquery`.

This project uses generated `search_vector` values from chunk content.

## BM25-like Ranking

BM25 is a keyword ranking model based on term frequency, inverse document frequency, and document length normalization.

This project uses Postgres `ts_rank_cd`, which behaves like a practical keyword ranking signal but is not a custom BM25 implementation.

## RRF

Reciprocal Rank Fusion.

It combines multiple ranked lists by rank position rather than raw score.

Formula:

```text
1 / (k + rank)
```

## Region Type

The type of chunk extracted from the document.

Current values:

- `paragraph`
- `table`
- `footnote`
- `header`
- `footer`

