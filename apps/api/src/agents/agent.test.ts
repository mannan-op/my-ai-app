import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAgentLlmForTesting, setAgentLlmForTesting } from "../llm/agentLlm.js";
import { searchChunks } from "../retrieval.js";
import { runAgent } from "./index.js";
import { citationBuilderNode } from "./nodes/citationBuilderNode.js";
import { numericAnalystNode } from "./nodes/numericAnalystNode.js";
import { plannerNode } from "./nodes/plannerNode.js";
import { retrieverNode } from "./nodes/retrieverNode.js";
import { verifierNode } from "./nodes/verifierNode.js";
import { createInitialState, FilingLensState } from "./state.js";

vi.mock("../retrieval.js", () => ({
  searchChunks: vi.fn()
}));

const searchChunksMock = vi.mocked(searchChunks);

const revenueChunk = {
  chunk_id: "chunk_1",
  document_id: "doc_1",
  content: "Revenue was $100 in 2023 and $125 in 2024.",
  page_number: 4,
  bbox: [10, 20, 30, 40] as [number, number, number, number],
  region_type: "table" as const,
  score: 0.95
};

const riskChunk = {
  chunk_id: "chunk_2",
  document_id: "doc_1",
  content: "The company faces liquidity risk in international markets.",
  page_number: 9,
  bbox: [11, 21, 31, 41] as [number, number, number, number],
  region_type: "paragraph" as const,
  score: 0.86
};

describe("LangGraph agent nodes", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    resetAgentLlmForTesting();
  });

  it("creates planner output", async () => {
    const state = await plannerNode(createInitialState("What was revenue growth?", "doc_1"));

    expect(state.plan).toMatchObject({
      questionType: "calculation",
      needsCalculation: true
    });
    expect(state.plan?.subquestions).toEqual(["What was revenue growth?"]);
  });

  it("runs retrieval and deduplicates chunks", async () => {
    searchChunksMock.mockResolvedValue([revenueChunk, { ...revenueChunk, score: 0.7 }]);

    const planned = await plannerNode(createInitialState("What was revenue?", "doc_1"));
    const state = await retrieverNode(planned);

    expect(searchChunksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 1,
        topK: 10
      })
    );
    expect(state.retrievedChunks).toHaveLength(1);
    expect(state.retrievedChunks[0].chunkId).toBe("chunk_1");
  });

  it("extracts facts and performs deterministic calculations", async () => {
    const state = await numericAnalystNode({
      ...createInitialState("What was revenue growth?", "doc_1"),
      plan: {
        questionType: "calculation",
        subquestions: ["What was revenue growth?"],
        requiredEvidenceTypes: ["table"],
        needsCalculation: true
      },
      retrievedChunks: [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          content: revenueChunk.content,
          pageNumber: 4,
          bbox: revenueChunk.bbox,
          regionType: "table",
          score: 0.95
        }
      ]
    });

    expect(state.extractedFacts.map((fact) => fact.value)).toContain(100);
    expect(state.extractedFacts.map((fact) => fact.value)).toContain(125);
    expect(state.calculations[0]).toMatchObject({
      operator: "percentage_change",
      result: 25
    });
  });

  it("verifies missing evidence", async () => {
    const state = await verifierNode(createInitialState("What was revenue?", "doc_1"));

    expect(state.verification?.passed).toBe(false);
    expect(state.verification?.missingEvidence).toContain("No retrieved chunks were available.");
  });

  it("builds structured citations", async () => {
    const baseState = stateWithFact();
    const state = await citationBuilderNode(baseState);

    expect(state.citations).toEqual([
      {
        id: "C1",
        chunkId: "chunk_1",
        documentId: "doc_1",
        pageNumber: 4,
        bbox: [10, 20, 30, 40],
        supports: ["fact_1"]
      }
    ]);
  });

  it("continues graph execution when retrieval fails", async () => {
    searchChunksMock.mockRejectedValue(new Error("database unavailable"));

    const state = await runAgent("What was revenue?", "doc_1");

    expect(state.errors.some((error) => error.includes("retrieverNode: database unavailable"))).toBe(true);
    expect(state.finalAnswer).toContain("I cannot answer this confidently");
  });
});

describe("LangGraph agent end to end", () => {
  beforeEach(() => {
    searchChunksMock.mockReset();
    resetAgentLlmForTesting();
  });

  it("executes the happy path graph", async () => {
    searchChunksMock.mockResolvedValue([revenueChunk, riskChunk]);

    const state = await runAgent("What was revenue growth?", "doc_1");

    expect(state.plan?.needsCalculation).toBe(true);
    expect(state.retrievedChunks).toHaveLength(2);
    expect(state.calculations[0].result).toBe(25);
    expect(state.verification?.passed).toBe(true);
    expect(state.citations.length).toBeGreaterThan(0);
    expect(state.finalAnswer).toContain("[C1]");
    expect(state.telemetry?.traceId).toBeTruthy();
    expect(state.telemetry?.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(state.telemetry?.stages.map((stage) => stage.stage)).toEqual(
      expect.arrayContaining([
        "planner",
        "retriever",
        "numeric_analyst",
        "verifier",
        "citation_generator",
        "final_answer"
      ])
    );
    expect(state.telemetry?.stages.every((stage) => stage.durationMs >= 0)).toBe(true);
  });

  it("uses a mocked LLM for planning and final answer generation", async () => {
    searchChunksMock.mockResolvedValue([riskChunk]);
    setAgentLlmForTesting({
      async createPlan() {
        return {
          questionType: "summary",
          subquestions: ["Summarize risk."],
          requiredEvidenceTypes: ["paragraph"],
          needsCalculation: false
        };
      },
      async createFinalAnswer(input) {
        return `Mock answer with ${input.facts.length} facts and ${input.citations.length} citations.`;
      }
    });

    const state = await runAgent("Summarize risk.", "doc_1");

    expect(state.plan?.questionType).toBe("summary");
    expect(state.finalAnswer).toBe("Mock answer with 1 facts and 1 citations.");
  });

  it("honors runtime top_k options", async () => {
    searchChunksMock.mockResolvedValue([revenueChunk]);

    await runAgent("What was revenue growth?", "doc_1", { topK: 3 });

    expect(searchChunksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: 3
      })
    );
  });
});

function stateWithFact(): FilingLensState {
  return {
    ...createInitialState("What was revenue?", "doc_1"),
    retrievedChunks: [
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: revenueChunk.content,
        pageNumber: 4,
        bbox: revenueChunk.bbox,
        regionType: "table",
        score: 0.95
      }
    ],
    extractedFacts: [
      {
        id: "fact_1",
        statement: "Revenue was $100 in 2023 and $125 in 2024.",
        value: 100,
        unit: "currency",
        sourceChunkId: "chunk_1",
        confidence: 0.95
      }
    ]
  };
}
