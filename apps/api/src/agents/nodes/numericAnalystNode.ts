import { Calculation, Fact, FilingLensState } from "../state.js";
import { runNode } from "./nodeUtils.js";
import { finishTracedStage, startTracedStage } from "../../observability/agentTracing.js";

const numberPattern = /(?<currency>\$)?(?<value>-?\d+(?:,\d{3})*(?:\.\d+)?)(?<percent>%?)/g;

export async function numericAnalystNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode("numericAnalystNode", state, async () => {
    const extractionStage = startTracedStage("fact_extraction");
    const extractedFacts = extractFacts(state);
    finishTracedStage(extractionStage, "ok", { metadata: { factCount: extractedFacts.length } });

    const calculationStage = startTracedStage("calculation_engine");
    const calculations = state.plan?.needsCalculation ? calculate(extractedFacts, state.question) : [];
    finishTracedStage(calculationStage, "ok", { metadata: { calculationCount: calculations.length } });

    return {
      ...state,
      extractedFacts,
      calculations
    };
  });
}

function extractFacts(state: FilingLensState): Fact[] {
  const facts: Fact[] = [];

  for (const chunk of state.retrievedChunks) {
    const matches = Array.from(chunk.content.matchAll(numberPattern)).slice(0, 4);

    if (matches.length === 0) {
      facts.push({
        id: `fact_${facts.length + 1}`,
        statement: snippet(chunk.content),
        sourceChunkId: chunk.chunkId,
        confidence: chunk.score
      });
      continue;
    }

    for (const match of matches) {
      const rawValue = match.groups?.value ?? "";
      const value = Number(rawValue.replace(/,/g, ""));

      if (!Number.isFinite(value)) {
        continue;
      }

      facts.push({
        id: `fact_${facts.length + 1}`,
        statement: `${snippet(chunk.content)} contains ${match[0]}`,
        value,
        unit: match.groups?.percent === "%" ? "percent" : match.groups?.currency === "$" ? "currency" : undefined,
        sourceChunkId: chunk.chunkId,
        confidence: chunk.score
      });
    }
  }

  return facts;
}

function calculate(facts: Fact[], question: string): Calculation[] {
  const allNumericFacts = facts.filter((fact): fact is Fact & { value: number } => fact.value !== undefined);
  const currencyFacts = allNumericFacts.filter((fact) => fact.unit === "currency");
  const numericFacts = currencyFacts.length >= 2 ? currencyFacts : allNumericFacts;

  if (numericFacts.length < 2) {
    return [];
  }

  const [first, second] = numericFacts;
  const normalized = question.toLowerCase();

  if (/\b(percent|percentage|growth|increase|decrease|change)\b/.test(normalized) && first.value !== 0) {
    return [
      {
        id: "calc_1",
        description: "Percentage change between the first two retrieved numeric facts",
        inputs: [
          { factId: first.id, value: first.value },
          { factId: second.id, value: second.value }
        ],
        operator: "percentage_change",
        result: ((second.value - first.value) / Math.abs(first.value)) * 100,
        unit: "percent"
      }
    ];
  }

  if (/\b(sum|total)\b/.test(normalized)) {
    return [
      {
        id: "calc_1",
        description: "Sum of the first two retrieved numeric facts",
        inputs: [
          { factId: first.id, value: first.value },
          { factId: second.id, value: second.value }
        ],
        operator: "sum",
        result: first.value + second.value,
        unit: first.unit === second.unit ? first.unit : undefined
      }
    ];
  }

  return [
    {
      id: "calc_1",
      description: "Difference between the first two retrieved numeric facts",
      inputs: [
        { factId: first.id, value: first.value },
        { factId: second.id, value: second.value }
      ],
      operator: "difference",
      result: second.value - first.value,
      unit: first.unit === second.unit ? first.unit : undefined
    }
  ];
}

function snippet(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}
