import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

import { pool } from "./db.js";
import {
  fuseResults,
  InvalidRetrievalRequestError,
  parseRetrievalRequest,
  searchChunks
} from "./retrieval.js";

const queryMock = vi.mocked(pool.query);

const tableChunk = {
  chunk_id: 1,
  document_id: 7,
  content: "R&D expense was $100 in 2024",
  page_number: 54,
  bbox: { x0: 80, y0: 220, x1: 540, y1: 430 },
  region_type: "table",
  score: 0.82
};

const paragraphChunk = {
  chunk_id: 2,
  document_id: 7,
  content: "Revenue increased because of research investments",
  page_number: 12,
  bbox: { x0: 50, y0: 100, x1: 500, y1: 160 },
  region_type: "paragraph",
  score: 0.7
};

describe("retrieval request validation", () => {
  it("parses string document IDs and defaults top_k", () => {
    expect(
      parseRetrievalRequest({
        document_id: "doc_123",
        query: "R&D expense 2024 revenue"
      })
    ).toEqual({
      documentId: 123,
      query: "R&D expense 2024 revenue",
      topK: 8,
      regionType: undefined
    });
  });

  it("rejects invalid request bodies", () => {
    expect(() => parseRetrievalRequest({ document_id: "doc_1", query: "" })).toThrow(
      InvalidRetrievalRequestError
    );
    expect(() => parseRetrievalRequest({ query: "revenue" })).toThrow(
      "A valid document_id is required."
    );
    expect(() =>
      parseRetrievalRequest({ document_id: 1, query: "revenue", region_type: "chart" })
    ).toThrow("region_type must be paragraph, table, footnote, header, or footer.");
  });
});

describe("hybrid retrieval", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns fused chunks for a successful hybrid retrieval", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [tableChunk, paragraphChunk] } as never)
      .mockResolvedValueOnce({ rows: [tableChunk] } as never);

    const chunks = await searchChunks({
      documentId: 7,
      query: "R&D expense 2024 revenue",
      topK: 8,
      regionType: undefined
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunk_id: "chunk_1",
      document_id: "doc_7",
      content: "R&D expense was $100 in 2024",
      page_number: 54,
      bbox: [80, 220, 540, 430],
      region_type: "table",
      score: 1
    });
  });

  it("applies document ID filtering to vector and keyword searches", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [tableChunk] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await searchChunks({
      documentId: 7,
      query: "revenue",
      topK: 3,
      regionType: undefined
    });

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][1]?.[0]).toBe(7);
    expect(queryMock.mock.calls[1][1]?.[0]).toBe(7);
  });

  it("applies region type filtering to vector and keyword searches", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [tableChunk] } as never)
      .mockResolvedValueOnce({ rows: [tableChunk] } as never);

    await searchChunks({
      documentId: 7,
      query: "R&D",
      topK: 3,
      regionType: "table"
    });

    expect(queryMock.mock.calls[0][1]?.[1]).toBe("table");
    expect(queryMock.mock.calls[1][1]?.[1]).toBe("table");
  });

  it("returns an empty list when both retrieval strategies have no matches", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(
      searchChunks({
        documentId: 7,
        query: "does not exist",
        topK: 8,
        regionType: undefined
      })
    ).resolves.toEqual([]);
  });
});

describe("RRF fusion", () => {
  it("promotes chunks that appear in both semantic and keyword rankings", () => {
    const chunks = fuseResults(
      [tableChunk, paragraphChunk] as never,
      [paragraphChunk, { ...tableChunk, chunk_id: 3, content: "Revenue table" }] as never
    );

    expect(chunks[0].chunk_id).toBe("chunk_2");
    expect(chunks[0].score).toBe(1);
    expect(chunks.map((chunk) => chunk.chunk_id)).toEqual(["chunk_2", "chunk_1", "chunk_3"]);
  });
});
