import { END, START, StateGraph } from "@langchain/langgraph";
import { citationBuilderNode } from "./nodes/citationBuilderNode.js";
import { finalAnswerNode } from "./nodes/finalAnswerNode.js";
import { numericAnalystNode } from "./nodes/numericAnalystNode.js";
import { plannerNode } from "./nodes/plannerNode.js";
import { retrieverNode } from "./nodes/retrieverNode.js";
import { verifierNode } from "./nodes/verifierNode.js";
import { FilingLensAnnotation } from "./state.js";

export function buildAgentGraph() {
  return new StateGraph(FilingLensAnnotation)
    .addNode("plannerNode", plannerNode)
    .addNode("retrieverNode", retrieverNode)
    .addNode("numericAnalystNode", numericAnalystNode)
    .addNode("verifierNode", verifierNode)
    .addNode("citationBuilderNode", citationBuilderNode)
    .addNode("finalAnswerNode", finalAnswerNode)
    .addEdge(START, "plannerNode")
    .addEdge("plannerNode", "retrieverNode")
    .addEdge("retrieverNode", "numericAnalystNode")
    .addEdge("numericAnalystNode", "verifierNode")
    .addEdge("verifierNode", "citationBuilderNode")
    .addEdge("citationBuilderNode", "finalAnswerNode")
    .addEdge("finalAnswerNode", END)
    .compile();
}

export const filingLensGraph = buildAgentGraph();

