import { filingLensGraph } from "./graph.js";
import { createInitialState, FilingLensState } from "./state.js";

export async function runAgent(question: string, documentId: string): Promise<FilingLensState> {
  const trimmedQuestion = question.trim();
  const trimmedDocumentId = documentId.trim();

  if (!trimmedQuestion) {
    throw new Error("question is required");
  }

  if (!trimmedDocumentId) {
    throw new Error("documentId is required");
  }

  return filingLensGraph.invoke(createInitialState(trimmedQuestion, trimmedDocumentId));
}

export type {
  AgentPlan,
  Calculation,
  Citation,
  Fact,
  FilingLensState,
  RetrievedChunk,
  VerificationResult
} from "./state.js";

