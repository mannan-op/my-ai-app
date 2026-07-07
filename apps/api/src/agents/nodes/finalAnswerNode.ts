import { getAgentLlm } from "../../llm/agentLlm.js";
import { FilingLensState } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function finalAnswerNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode("finalAnswerNode", state, async () => {
    const input = {
      question: state.question,
      plan: state.plan,
      facts: state.extractedFacts,
      calculations: state.calculations,
      verification: state.verification,
      citations: state.citations
    };
    const llm = getAgentLlm();
    let finalAnswer = "";

    if (state.runtime?.onAnswerToken) {
      for await (const token of llm.createFinalAnswerStream(input)) {
        state.runtime.onAnswerToken(token);
        finalAnswer += token;
      }
    } else {
      finalAnswer = await llm.createFinalAnswer(input);
    }

    return {
      ...state,
      finalAnswer
    };
  });
}

