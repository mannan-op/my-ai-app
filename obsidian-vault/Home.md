# My AI App Knowledge Vault

This vault documents the project state up to Milestone 5: Model Server.

## Start Here

- [[Project Overview]]
- [[Architecture/System Architecture]]
- [[Runbooks/Run And Check The Project]]
- [[Workflows/End-to-End Document Workflow]]
- [[Workflows/Hybrid Retrieval Workflow]]
- [[Workflows/LangGraph Agent Workflow]]
- [[Workflows/Model Server Inference Workflow]]

## Main Areas

- [[API/API Reference]]
- [[Database/Database Schema]]
- [[Architecture/Services]]
- [[Architecture/Code Map]]
- [[Tests/Test Strategy]]
- [[Milestones/Milestone Timeline]]
- [[Milestones/Milestone 5 - Model Server]]
- [[Milestones/Milestone 6 - LangGraph Agent System]]
- [[Glossary/Retrieval Glossary]]

## Current Capability

The system can upload PDF documents, extract layout-aware document chunks, store chunks in Postgres, generate embeddings, and search chunks with hybrid retrieval.

The model server also exposes inference APIs for table question answering, NLI verification, layout document QA, vision QA, and section classification.

The current retrieval path combines:

- semantic vector search with pgvector
- keyword search with Postgres full-text search
- BM25-like keyword ranking using `ts_rank_cd`
- Reciprocal Rank Fusion for final ranking
- metadata filters for `document_id` and `region_type`

Milestone 6 wraps retrieval in a LangGraph agent that plans, retrieves, extracts facts, performs deterministic calculations, verifies evidence, builds citations, and produces a final markdown answer.
