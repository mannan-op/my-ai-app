import { filingLensGraph } from "./graph.js";
import { AgentRuntimeOptions, createInitialState, FilingLensState } from "./state.js";
import { withAgentTrace } from "../observability/agentTracing.js";

export async function runAgent(
  question: string,
  documentId: string,
  options: AgentRuntimeOptions = {}
): Promise<FilingLensState> {
  const trimmedQuestion = question.trim();
  const trimmedDocumentId = documentId.trim();

  if (!trimmedQuestion) {
    throw new Error("question is required");
  }

  if (!trimmedDocumentId) {
    throw new Error("documentId is required");
  }

  const { result, telemetry } = await withAgentTrace(
    {
      question: trimmedQuestion,
      documentId: trimmedDocumentId,
      questionId: options.questionId,
      evaluationId: options.evaluationId,
      saveTraces: options.saveTraces
    },
    () => filingLensGraph.invoke(createInitialState(trimmedQuestion, trimmedDocumentId, options))
  );

  return {
    ...result,
    telemetry
  };
}

export type {
  AgentRuntimeOptions,
  AgentPlan,
  Calculation,
  Citation,
  Fact,
  FilingLensState,
  RetrievedChunk,
  VerificationResult
} from "./state.js";
