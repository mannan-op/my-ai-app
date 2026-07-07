export type RegionType = "paragraph" | "table" | "footnote" | "header" | "footer";

export type DocumentRecord = {
  id: number;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  filingType: string | null;
  ticker: string | null;
  companyName: string | null;
  source: string | null;
  createdAt: string;
};

export type DocumentChunk = {
  id: number;
  documentId: number;
  pageNumber: number;
  chunkType: RegionType;
  content: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  orderIndex: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPlan = {
  questionType: string;
  subquestions: string[];
  requiredEvidenceTypes: RegionType[];
  needsCalculation: boolean;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber: number;
  bbox: [number, number, number, number];
  regionType: RegionType;
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

export type StageTelemetry = {
  stage: string;
  durationMs: number;
  status: "ok" | "error";
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
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

export type AgentState = {
  question: string;
  documentId: string;
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

export type ExtractSummary = {
  documentId: number;
  totalPagesProcessed: number;
  totalChunksCreated: number;
  countByType: Record<RegionType, number>;
  errors: Array<{ pageNumber: number; message: string }>;
};

export type HealthStatus = {
  service: string;
  status: "ok" | "error";
  database?: "ok" | "error" | "unknown";
};

export type EvaluationMetrics = {
  retrieval_hit_rate: number;
  context_precision: number;
  context_recall: number;
  faithfulness: number;
  answer_relevancy: number;
  citation_accuracy: number;
  numeric_accuracy: number;
};

export type EvaluationExample = {
  id: string;
  document_id: string;
  question: string;
  expected_answer: string;
  predicted_answer: string;
  metrics: EvaluationMetrics;
  telemetry?: PipelineTelemetry;
  errors: string[];
  runtime_seconds?: number;
};

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
      data: Partial<AgentState>;
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
      state: AgentState;
    };

export type EvaluationRunStatus = {
  status: "idle" | "running" | "completed" | "failed";
  evaluation_id?: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
};

export type EvaluationResults = {
  evaluation_id: string;
  summary: EvaluationMetrics & {
    total_questions: number;
    average_latency_ms: number;
    average_cost_usd: number;
  };
  examples: EvaluationExample[];
};

