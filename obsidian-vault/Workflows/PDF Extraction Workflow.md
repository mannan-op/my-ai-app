# PDF Extraction Workflow

PDF extraction is split between the API and the Python model server.

## API Responsibilities

File: `apps/api/src/pdfExtraction.ts`

The API:

- validates the document exists
- checks the stored PDF file exists
- reads the PDF from disk
- sends the PDF to the model server
- validates returned chunk types
- stores chunks in Postgres
- returns an extraction summary

## Model Server Responsibilities

Files:

- `apps/model-server/app/main.py`
- `apps/model-server/app/pdf_extraction.py`

The model server:

- receives PDF bytes
- extracts text blocks with PyMuPDF
- extracts tables with pdfplumber
- classifies page regions
- returns chunk objects

## Region Types

- `paragraph`
- `table`
- `footnote`
- `header`
- `footer`

## Classification Logic

Headers:

- near top of page
- or repeated top text across pages

Footers:

- near bottom of page
- repeated bottom text
- page numbers

Footnotes:

- low on page
- smaller font
- footnote-like prefix

Tables:

- detected by pdfplumber

Paragraphs:

- normal text blocks that are not classified as another region

## Output Shape

Each extracted chunk includes:

- `pageNumber`
- `chunkType`
- `content`
- `bbox`
- `orderIndex`
- `metadata`

Related notes:

- [[Database/Database Schema]]
- [[Workflows/End-to-End Document Workflow]]

