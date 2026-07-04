import { pool } from "./db.js";
import { embeddingToSqlVector, generateEmbedding } from "./embeddings.js";
import { ChunkType, isChunkType } from "./documentChunks.js";
import { finishTracedStage, startTracedStage } from "./observability/agentTracing.js";

const DEFAULT_TOP_K = 8;
const MAX_TOP_K = 50;
const CANDIDATE_MULTIPLIER = 8;
const RRF_K = 60;

export type RetrievalFilters = {
  documentId: number;
  regionType?: ChunkType;
};

export type RetrievalSearchInput = RetrievalFilters & {
  query: string;
  topK: number;
};

export type RetrievalChunk = {
  chunk_id: string;
  document_id: string;
  content: string;
  page_number: number;
  bbox: [number, number, number, number];
  region_type: ChunkType;
  score: number;
};

type SearchRow = {
  chunk_id: number;
  document_id: number;
  content: string;
  page_number: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  region_type: ChunkType;
  score: string | number;
};

export class InvalidRetrievalRequestError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function parseRetrievalRequest(body: unknown): RetrievalSearchInput {
  if (!body || typeof body !== "object") {
    throw new InvalidRetrievalRequestError("Request body must be a JSON object.");
  }

  const input = body as Record<string, unknown>;
  const query = typeof input.query === "string" ? input.query.trim() : "";

  if (!query) {
    throw new InvalidRetrievalRequestError("Query text is required.");
  }

  const documentId = parseDocumentId(input.document_id);

  if (!documentId) {
    throw new InvalidRetrievalRequestError("A valid document_id is required.");
  }

  const topK = parseTopK(input.top_k);
  const regionType = input.region_type;

  if (regionType !== undefined && !isChunkType(regionType)) {
    throw new InvalidRetrievalRequestError(
      "region_type must be paragraph, table, footnote, header, or footer."
    );
  }

  return {
    documentId,
    query,
    topK,
    regionType
  };
}

export async function searchChunks(input: RetrievalSearchInput): Promise<RetrievalChunk[]> {
  const queryEmbedding = await generateEmbedding(input.query);
  const candidateLimit = Math.min(Math.max(input.topK * CANDIDATE_MULTIPLIER, 20), 200);

  const [vectorRows, keywordRows] = await Promise.all([
    searchVector(input, queryEmbedding, candidateLimit),
    searchKeyword(input, candidateLimit)
  ]);

  const rerankerStage = startTracedStage("reranker");
  const fused = fuseResults(vectorRows, keywordRows).slice(0, input.topK);
  finishTracedStage(rerankerStage, "ok", {
    metadata: {
      vectorCandidates: vectorRows.length,
      keywordCandidates: keywordRows.length,
      returnedCandidates: fused.length
    }
  });

  return fused;
}

export function fuseResults(
  vectorRows: SearchRow[],
  keywordRows: SearchRow[],
  rrfK = RRF_K
): RetrievalChunk[] {
  const fused = new Map<
    number,
    {
      row: SearchRow;
      score: number;
    }
  >();

  addRankedRows(fused, vectorRows, rrfK);
  addRankedRows(fused, keywordRows, rrfK);

  const maxScore = Math.max(...Array.from(fused.values(), (item) => item.score), 0);

  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score || Number(b.row.score) - Number(a.row.score))
    .map(({ row, score }) => mapSearchRow(row, maxScore > 0 ? score / maxScore : 0));
}

async function searchVector(
  input: RetrievalSearchInput,
  queryEmbedding: number[],
  limit: number
): Promise<SearchRow[]> {
  const { clauses, values } = filterSql(input);
  values.push(embeddingToSqlVector(queryEmbedding));
  const embeddingParam = values.length;
  values.push(limit);
  const limitParam = values.length;

  const result = await pool.query<SearchRow>(
    `
      SELECT
        id AS chunk_id,
        document_id,
        content,
        page_number,
        bbox,
        chunk_type AS region_type,
        1 - (embedding <=> $${embeddingParam}::vector) AS score
      FROM document_chunks
      WHERE ${clauses.join(" AND ")}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $${embeddingParam}::vector
      LIMIT $${limitParam}
    `,
    values
  );

  return result.rows;
}

async function searchKeyword(input: RetrievalSearchInput, limit: number): Promise<SearchRow[]> {
  const { clauses, values } = filterSql(input);
  values.push(input.query);
  const queryParam = values.length;
  values.push(limit);
  const limitParam = values.length;

  const result = await pool.query<SearchRow>(
    `
      WITH keyword_query AS (
        SELECT websearch_to_tsquery('english', $${queryParam}) AS query
      )
      SELECT
        document_chunks.id AS chunk_id,
        document_chunks.document_id,
        document_chunks.content,
        document_chunks.page_number,
        document_chunks.bbox,
        document_chunks.chunk_type AS region_type,
        ts_rank_cd(document_chunks.search_vector, keyword_query.query, 32) AS score
      FROM document_chunks, keyword_query
      WHERE ${clauses.join(" AND ")}
        AND document_chunks.search_vector @@ keyword_query.query
      ORDER BY score DESC, document_chunks.id ASC
      LIMIT $${limitParam}
    `,
    values
  );

  return result.rows;
}

function filterSql(input: RetrievalSearchInput): { clauses: string[]; values: unknown[] } {
  const values: unknown[] = [input.documentId];
  const clauses = ["document_id = $1"];

  if (input.regionType) {
    values.push(input.regionType);
    clauses.push(`chunk_type = $${values.length}`);
  }

  return { clauses, values };
}

function addRankedRows(
  fused: Map<number, { row: SearchRow; score: number }>,
  rows: SearchRow[],
  rrfK: number
) {
  for (const [index, row] of rows.entries()) {
    const rank = index + 1;
    const existing = fused.get(row.chunk_id);
    const score = 1 / (rrfK + rank);

    if (existing) {
      existing.score += score;
    } else {
      fused.set(row.chunk_id, { row, score });
    }
  }
}

function mapSearchRow(row: SearchRow, score: number): RetrievalChunk {
  return {
    chunk_id: `chunk_${row.chunk_id}`,
    document_id: `doc_${row.document_id}`,
    content: row.content,
    page_number: row.page_number,
    bbox: [row.bbox.x0, row.bbox.y0, row.bbox.x1, row.bbox.y1],
    region_type: row.region_type,
    score: Number(score.toFixed(6))
  };
}

function parseDocumentId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const match = /^(?:doc_)?(\d+)$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseTopK(value: unknown): number {
  if (value === undefined) {
    return DEFAULT_TOP_K;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > MAX_TOP_K) {
    throw new InvalidRetrievalRequestError(`top_k must be an integer between 1 and ${MAX_TOP_K}.`);
  }

  return value;
}
