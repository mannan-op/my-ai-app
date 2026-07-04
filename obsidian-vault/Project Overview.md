# Project Overview

This project is a document retrieval application built as a small monorepo.

## Purpose

The project ingests PDF documents, extracts meaningful regions from each page, stores those regions as chunks, generates embeddings, retrieves the best matching chunks for a user question, runs a LangGraph agent for verified cited answers, and exposes model-server inference APIs for table QA, NLI verification, layout document QA, vision QA, and section classification.

It is currently closer to a retrieval backend than a full chat application. A future RAG layer could pass retrieved chunks to an LLM to generate final answers.

## Repository Shape

- `apps/web`: Next.js frontend
- `apps/api`: Node.js Express API
- `apps/model-server`: Python FastAPI extraction service
- `infra/postgres`: Postgres bootstrap SQL
- `docker-compose.yaml`: local multi-service runtime
- `obsidian-vault`: this documentation vault

## Main Runtime Services

- [[Architecture/Services#Web]]
- [[Architecture/Services#API]]
- [[Architecture/Services#Model Server]]
- [[Architecture/Services#Postgres]]

## Main Workflows

- [[Workflows/End-to-End Document Workflow]]
- [[Workflows/PDF Extraction Workflow]]
- [[Workflows/Hybrid Retrieval Workflow]]
- [[Workflows/LangGraph Agent Workflow]]
- [[Workflows/Model Server Inference Workflow]]

## Current Milestone

See [[Milestones/Milestone 4 - Hybrid Retrieval]], [[Milestones/Milestone 5 - Model Server]], and [[Milestones/Milestone 6 - LangGraph Agent System]].
