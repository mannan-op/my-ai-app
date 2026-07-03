# Code Map

## API Entry

`apps/api/src/index.ts`

- Creates the Express app.
- Enables CORS and JSON parsing.
- Mounts `/documents`.
- Mounts `/retrieval`.
- Exposes `/health`.
- Runs `ensureDatabaseSchema()` before listening.

## Document Upload

`apps/api/src/documentRoutes.ts`

- Defines document routes.
- Uses `multer` memory storage.
- Limits uploads to 50 MB.
- Validates file presence and PDF type.

`apps/api/src/documents.ts`

- Validates PDF readability with `pdf-lib`.
- Counts pages.
- Stores file on disk.
- Inserts document metadata into Postgres.

## Document Chunks

`apps/api/src/documentChunks.ts`

- Defines chunk types.
- Stores extracted chunks.
- Generates embeddings before insert.
- Replaces old chunks for a document inside a transaction.
- Lists chunks with optional page/type filters.

## PDF Extraction Bridge

`apps/api/src/pdfExtraction.ts`

- Loads a stored PDF.
- Calls the model server `/pdf/extract` endpoint.
- Validates returned chunk types.
- Stores extracted chunks.
- Returns extraction summary.

## Model Server Extraction

`apps/model-server/app/main.py`

- Exposes `/health`.
- Exposes `/pdf/extract`.
- Validates upload content type.

`apps/model-server/app/pdf_extraction.py`

- Uses PyMuPDF for text blocks and page geometry.
- Uses pdfplumber for table extraction.
- Classifies text blocks into `header`, `footer`, `footnote`, or `paragraph`.

## Model Server Inference

`apps/model-server/app/api/model_routes.py`

- Exposes `POST /table/qa`.
- Exposes `POST /verify/nli`.
- Exposes `POST /layout/document-qa`.
- Exposes `POST /vision/qa`.
- Exposes `POST /classify/section`.
- Maps service failures to HTTP responses.

`apps/model-server/app/core/config.py`

- Reads model names, cache directory, device, batch size, max sequence length, and preload behavior.

`apps/model-server/app/models/registry.py`

- Provides lazy singleton model loading.
- Selects CPU/GPU device.
- Keeps model loading centralized for future multimodal endpoints.

`apps/model-server/app/services/table_qa_service.py`

- Converts JSON table rows into a pandas DataFrame.
- Calls the TAPAS-style table QA pipeline.

`apps/model-server/app/services/nli_service.py`

- Calls the NLI pipeline with truncation.
- Normalizes output labels.

`apps/model-server/app/services/layout_document_qa_service.py`

- Decodes a base64 document image.
- Calls the document question answering pipeline.

`apps/model-server/app/services/vision_qa_service.py`

- Decodes a base64 image.
- Calls the visual question answering pipeline.

`apps/model-server/app/services/section_classifier_service.py`

- Calls the zero-shot classifier over document section labels.

## Retrieval

`apps/api/src/retrievalRoutes.ts`

- Exposes `POST /retrieval/search`.
- Converts validation errors into 400 responses.

`apps/api/src/retrieval.ts`

- Validates request shape.
- Generates query embedding.
- Searches vectors.
- Searches full-text.
- Fuses results with RRF.

`apps/api/src/embeddings.ts`

- Provides embedding generation.
- Supports deterministic local embeddings by default.
- Supports OpenAI embeddings through environment variables.
