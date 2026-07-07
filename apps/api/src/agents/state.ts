import { Annotation } from "@langchain/langgraph";
import { ChunkType } from "../documentChunks.js";

export type QuestionType = "financial_metric" | "comparison" | "calculation" | "summary" | "unknown";

export type AgentPlan = {
  questionType: QuestionType;
  subquestions: string[];
  requiredEvidenceTypes: ChunkType[];
  needsCalculation: boolean;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber: number;
  bbox: [number, number, number, number];
  regionType: ChunkType;
  score: number;
};

export type Fact = {
  id: string;
  statement: string;
  value?: number;
  unit?: string;
  sourceChunkId: string;
  confidence: number;
};

export type Calculation = {
  id: string;
  description: string;
  inputs: Array<{
    factId: string;
    value: number;
  }>;
  operator: "difference" | "percentage_change" | "sum";
  result: number;
  unit?: string;
};

export type VerificationResult = {
  confidence: number;
  unsupportedClaims: string[];
  missingEvidence: string[];
  conflictingEvidence: string[];
  passed: boolean;
  warnings: string[];
};

export type Citation = {
  id: string;
  chunkId: string;
  documentId: string;
  pageNumber: number;
  bbox: [number, number, number, number];
  supports: string[];
};

export type FilingLensState = {
  question: string;
  documentId: string;
  runtime?: AgentRuntimeOptions;
  plan?: AgentPlan;
  retrievedChunks: RetrievedChunk[];
  extractedFacts: Fact[];
  calculations: Calculation[];
  draftAnswer?: string;
  verification?: VerificationResult;
  citations: Citation[];
  finalAnswer?: string;
  errors: string[];
  telemetry?: PipelineTelemetry;
};

export type AgentRuntimeOptions = {
  topK?: number;
  questionId?: string;
  evaluationId?: string;
  saveTraces?: boolean;
  onAnswerToken?: (token: string) => void;
};

export type StageTelemetry = {
  stage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "ok" | "error";
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  metadata?: Record<string, string | number | boolean | string[] | number[]>;
  error?: string;
};

export type PipelineTelemetry = {
  traceId: string;
  totalDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  stages: StageTelemetry[];
};

export const FilingLensAnnotation = Annotation.Root({
  question: Annotation<string>(),
  documentId: Annotation<string>(),
  runtime: Annotation<AgentRuntimeOptions | undefined>(),
  plan: Annotation<AgentPlan | undefined>(),
  retrievedChunks: Annotation<RetrievedChunk[]>(),
  extractedFacts: Annotation<Fact[]>(),
  calculations: Annotation<Calculation[]>(),
  draftAnswer: Annotation<string | undefined>(),
  verification: Annotation<VerificationResult | undefined>(),
  citations: Annotation<Citation[]>(),
  finalAnswer: Annotation<string | undefined>(),
  errors: Annotation<string[]>(),
  telemetry: Annotation<PipelineTelemetry | undefined>()
});

export function createInitialState(
  question: string,
  documentId: string,
  runtime?: AgentRuntimeOptions
): FilingLensState {
  return {
    question,
    documentId,
    runtime,
    retrievedChunks: [],
    extractedFacts: [],
    calculations: [],
    citations: [],
    errors: []
  };
}
