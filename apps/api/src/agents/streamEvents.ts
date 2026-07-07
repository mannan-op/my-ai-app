import { FilingLensState } from "./state.js";
import { toStageName } from "./nodes/nodeUtils.js";

export type AgentStreamStage =
  | "planner"
  | "retriever"
  | "numeric_analyst"
  | "verifier"
  | "citation_generator"
  | "final_answer";

export type AgentStreamEvent =
  | {
      type: "run_start";
      question: string;
      document_id: string;
    }
  | {
      type: "stage_complete";
      stage: AgentStreamStage;
      node: string;
      data: Record<string, unknown>;
    }
  | {
      type: "answer_token";
      token: string;
      stage: "final_answer";
    }
  | {
      type: "error";
      message: string;
      stage?: AgentStreamStage;
    }
  | {
      type: "done";
      state: FilingLensState;
    };

export function createStageEvent(node: string, state: FilingLensState): AgentStreamEvent {
  const stage = toStageName(node) as AgentStreamStage;

  return {
    type: "stage_complete",
    stage,
    node,
    data: pickStageData(stage, state)
  };
}

function pickStageData(stage: AgentStreamStage, state: FilingLensState): Record<string, unknown> {
  switch (stage) {
    case "planner":
      return { plan: state.plan };
    case "retriever":
      return { retrievedChunks: state.retrievedChunks };
    case "numeric_analyst":
      return { extractedFacts: state.extractedFacts, calculations: state.calculations };
    case "verifier":
      return { verification: state.verification };
    case "citation_generator":
      return { citations: state.citations };
    case "final_answer":
      return { finalAnswer: state.finalAnswer };
    default:
      return {};
  }
}
