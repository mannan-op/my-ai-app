import { getAgentLlm } from "../../llm/agentLlm.js";
import { FilingLensState } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function finalAnswerNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode("finalAnswerNode", state, async () => {
    const finalAnswer = await getAgentLlm().createFinalAnswer({
      question: state.question,
      plan: state.plan,
      facts: state.extractedFacts,
      calculations: state.calculations,
      verification: state.verification,
      citations: state.citations
    });

    return {
      ...state,
      finalAnswer
    };
  });
}

