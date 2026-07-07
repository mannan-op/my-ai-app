import { filingLensGraph } from "./graph.js";
import { AgentRuntimeOptions, createInitialState, FilingLensState } from "./state.js";
import { withAgentTrace } from "../observability/agentTracing.js";
import { AgentStreamEvent, createStageEvent } from "./streamEvents.js";

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

export async function runAgentStream(
  question: string,
  documentId: string,
  options: AgentRuntimeOptions,
  emit: (event: AgentStreamEvent) => void
): Promise<FilingLensState> {
  const trimmedQuestion = question.trim();
  const trimmedDocumentId = documentId.trim();

  if (!trimmedQuestion) {
    throw new Error("question is required");
  }

  if (!trimmedDocumentId) {
    throw new Error("documentId is required");
  }

  emit({
    type: "run_start",
    question: trimmedQuestion,
    document_id: trimmedDocumentId
  });

  const streamOptions = {
    ...options,
    onAnswerToken: (token: string) => {
      emit({
        type: "answer_token",
        token,
        stage: "final_answer"
      });
    }
  };

  const { result, telemetry } = await withAgentTrace(
    {
      question: trimmedQuestion,
      documentId: trimmedDocumentId,
      questionId: options.questionId,
      evaluationId: options.evaluationId,
      saveTraces: options.saveTraces
    },
    async () => {
      let state = createInitialState(trimmedQuestion, trimmedDocumentId, streamOptions);
      const stream = await filingLensGraph.stream(state, { streamMode: "updates" });

      for await (const chunk of stream) {
        const entry = Object.entries(chunk)[0];

        if (!entry) {
          continue;
        }

        const [node, update] = entry;
        state = {
          ...state,
          ...(update as Partial<FilingLensState>)
        };
        emit(createStageEvent(node, state));
      }

      return state;
    }
  );

  const finalState = {
    ...result,
    telemetry
  };

  emit({
    type: "done",
    state: finalState
  });

  return finalState;
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
