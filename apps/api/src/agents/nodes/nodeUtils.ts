import { FilingLensState } from "../state.js";
import { logError, logInfo, LogFields } from "../../utils/logger.js";
import { finishTracedStage, startTracedStage } from "../../observability/agentTracing.js";

export async function runNode(
  nodeName: string,
  state: FilingLensState,
  work: () => Promise<FilingLensState>,
  fields: LogFields = {}
): Promise<FilingLensState> {
  const startedAt = Date.now();
  const stageId = startTracedStage(toStageName(nodeName));
  logInfo("agent_node_start", { nodeName, ...fields });

  try {
    const updatedState = await work();
    const durationMs = Date.now() - startedAt;
    const traceMetadata: Record<string, string | number | boolean | string[] | number[]> = {
      ...(fields as Record<string, string | number | boolean | string[] | number[] | undefined>),
      errorCount: updatedState.errors.length,
      retrievedChunkIds: updatedState.retrievedChunks.map((chunk) => chunk.chunkId),
      pageNumbers: updatedState.retrievedChunks.map((chunk) => chunk.pageNumber),
      scores: updatedState.retrievedChunks.map((chunk) => chunk.score)
    };
    finishTracedStage(stageId, "ok", { metadata: compact(traceMetadata) });
    logInfo("agent_node_complete", { nodeName, durationMs, errorCount: updatedState.errors.length });
    return updatedState;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startedAt;
    finishTracedStage(stageId, "error", { error: message, metadata: { nodeName, durationMs } });
    logError("agent_node_recoverable_error", {
      nodeName,
      durationMs,
      error: message
    });

    return {
      ...state,
      errors: [...state.errors, `${nodeName}: ${message}`]
    };
  }
}

export function appendError(state: FilingLensState, nodeName: string, message: string): FilingLensState {
  return {
    ...state,
    errors: [...state.errors, `${nodeName}: ${message}`]
  };
}

export function toStageName(nodeName: string): string {
  if (nodeName === "plannerNode") {
    return "planner";
  }

  if (nodeName === "retrieverNode") {
    return "retriever";
  }

  if (nodeName === "numericAnalystNode") {
    return "numeric_analyst";
  }

  if (nodeName === "verifierNode") {
    return "verifier";
  }

  if (nodeName === "citationBuilderNode") {
    return "citation_generator";
  }

  if (nodeName === "finalAnswerNode") {
    return "final_answer";
  }

  return nodeName;
}

function compact(input: Record<string, string | number | boolean | string[] | number[] | undefined>): Record<string, string | number | boolean | string[] | number[]> {
  const output: Record<string, string | number | boolean | string[] | number[]> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}
