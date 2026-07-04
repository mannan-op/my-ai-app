import { FilingLensState } from "../state.js";
import { logError, logInfo, LogFields } from "../../utils/logger.js";

export async function runNode(
  nodeName: string,
  state: FilingLensState,
  work: () => Promise<FilingLensState>,
  fields: LogFields = {}
): Promise<FilingLensState> {
  const startedAt = Date.now();
  logInfo("agent_node_start", { nodeName, ...fields });

  try {
    const updatedState = await work();
    logInfo("agent_node_complete", {
      nodeName,
      durationMs: Date.now() - startedAt,
      errorCount: updatedState.errors.length
    });
    return updatedState;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("agent_node_recoverable_error", {
      nodeName,
      durationMs: Date.now() - startedAt,
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

