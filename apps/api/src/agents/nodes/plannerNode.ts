import { getAgentLlm } from "../../llm/agentLlm.js";
import { FilingLensState } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function plannerNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode(
    "plannerNode",
    state,
    async () => {
      const plan = await getAgentLlm().createPlan(state.question);

      return {
        ...state,
        plan
      };
    },
    { questionLength: state.question.length }
  );
}

