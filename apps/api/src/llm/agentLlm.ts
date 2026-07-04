import { AgentPlan, Citation, Fact, Calculation, VerificationResult } from "../agents/state.js";

export type FinalAnswerInput = {
  question: string;
  plan: AgentPlan | undefined;
  facts: Fact[];
  calculations: Calculation[];
  verification: VerificationResult | undefined;
  citations: Citation[];
};

export type AgentLlm = {
  createPlan(question: string): Promise<AgentPlan>;
  createFinalAnswer(input: FinalAnswerInput): Promise<string>;
};

class DeterministicAgentLlm implements AgentLlm {
  async createPlan(question: string): Promise<AgentPlan> {
    const normalized = question.toLowerCase();
    const needsCalculation = /\b(change|growth|increase|decrease|difference|sum|total|percent|percentage)\b/.test(
      normalized
    );
    const questionType = needsCalculation
      ? "calculation"
      : /\b(compare|versus|vs\.?)\b/.test(normalized)
        ? "comparison"
        : /\b(revenue|expense|income|cash|assets|liabilities|margin)\b/.test(normalized)
          ? "financial_metric"
          : /\b(summary|summarize|describe)\b/.test(normalized)
            ? "summary"
            : "unknown";

    const requiredEvidenceTypes = normalized.includes("table")
      ? ["table" as const]
      : ["table" as const, "paragraph" as const];

    return {
      questionType,
      subquestions: [question],
      requiredEvidenceTypes,
      needsCalculation
    };
  }

  async createFinalAnswer(input: FinalAnswerInput): Promise<string> {
    if (input.verification && !input.verification.passed) {
      const missing = input.verification.missingEvidence.join("; ") || "sufficient supporting evidence";
      return `I cannot answer this confidently because the agent is missing ${missing}.`;
    }

    const citationByChunk = new Map(input.citations.map((citation) => [citation.chunkId, citation.id]));
    const lines: string[] = [`### Answer`, ""];

    if (input.calculations.length > 0) {
      for (const calculation of input.calculations) {
        const citationIds = input.facts
          .filter((fact) => calculation.inputs.some((inputFact) => inputFact.factId === fact.id))
          .map((fact) => citationByChunk.get(fact.sourceChunkId))
          .filter((citationId): citationId is string => citationId !== undefined);
        lines.push(
          `- ${calculation.description}: ${formatNumber(calculation.result)}${calculation.unit ? ` ${calculation.unit}` : ""}${formatCitationList(citationIds)}`
        );
      }
    } else if (input.facts.length > 0) {
      for (const fact of input.facts.slice(0, 4)) {
        lines.push(`- ${fact.statement}${formatCitationList([citationByChunk.get(fact.sourceChunkId)])}`);
      }
    } else {
      lines.push("- I could not find enough supported facts to answer the question.");
    }

    return lines.join("\n");
  }
}

let activeLlm: AgentLlm = new DeterministicAgentLlm();

export function getAgentLlm(): AgentLlm {
  return activeLlm;
}

export function setAgentLlmForTesting(llm: AgentLlm): void {
  activeLlm = llm;
}

export function resetAgentLlmForTesting(): void {
  activeLlm = new DeterministicAgentLlm();
}

function formatCitationList(citationIds: Array<string | undefined>): string {
  const filtered = Array.from(
    new Set(citationIds.filter((citationId): citationId is string => citationId !== undefined))
  );
  return filtered.length > 0 ? ` [${filtered.join(", ")}]` : "";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
