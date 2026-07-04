import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { logError, logWarn } from "../utils/logger.js";
import { PipelineTelemetry, StageTelemetry } from "../agents/state.js";

type Primitive = string | number | boolean | string[] | number[];

type StageStart = {
  id: string;
  stage: string;
  startedAt: number;
};

export type AgentTraceMetadata = {
  question: string;
  documentId: string;
  questionId?: string;
  evaluationId?: string;
  saveTraces?: boolean;
};

type StageDetails = {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  metadata?: Record<string, Primitive>;
  error?: string;
};

class AgentTraceSession {
  private readonly traceId = crypto.randomUUID();
  private readonly startedAt = Date.now();
  private readonly stages: StageTelemetry[] = [];
  private readonly startedStages = new Map<string, StageStart>();
  private readonly langfuse = createLangfuseClient();

  constructor(private readonly metadata: AgentTraceMetadata) {
    this.langfuse?.createTrace(this.traceId, metadata);
  }

  startStage(stage: string): string {
    const id = crypto.randomUUID();
    this.startedStages.set(id, { id, stage, startedAt: Date.now() });
    this.langfuse?.createSpan({
      spanId: id,
      traceId: this.traceId,
      name: stage,
      input: {
        questionId: this.metadata.questionId,
        evaluationId: this.metadata.evaluationId,
        documentId: this.metadata.documentId
      }
    });
    return id;
  }

  finishStage(stageId: string, status: "ok" | "error", details: StageDetails = {}) {
    const start = this.startedStages.get(stageId);

    if (!start) {
      return;
    }

    this.startedStages.delete(stageId);
    const endedAt = Date.now();
    const stageTelemetry: StageTelemetry = {
      stage: start.stage,
      startedAt: new Date(start.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: endedAt - start.startedAt,
      status,
      model: details.model,
      promptTokens: details.promptTokens,
      completionTokens: details.completionTokens,
      estimatedCostUsd: details.estimatedCostUsd,
      metadata: details.metadata,
      error: details.error
    };
    this.stages.push(stageTelemetry);
    this.langfuse?.endSpan({
      spanId: stageId,
      traceId: this.traceId,
      output: {
        status,
        stage: start.stage,
        durationMs: stageTelemetry.durationMs,
        metadata: details.metadata,
        error: details.error
      }
    });
  }

  toTelemetry(): PipelineTelemetry {
    const totalDurationMs = Date.now() - this.startedAt;
    const promptTokens = this.stages.reduce((sum, stage) => sum + (stage.promptTokens ?? 0), 0);
    const completionTokens = this.stages.reduce((sum, stage) => sum + (stage.completionTokens ?? 0), 0);
    const estimatedCostUsd = Number(
      this.stages.reduce((sum, stage) => sum + (stage.estimatedCostUsd ?? 0), 0).toFixed(8)
    );

    return {
      traceId: this.traceId,
      totalDurationMs,
      promptTokens,
      completionTokens,
      estimatedCostUsd,
      stages: this.stages
    };
  }

  async finalize(errorMessage?: string) {
    this.langfuse?.endTrace({
      traceId: this.traceId,
      output: {
        error: errorMessage,
        status: errorMessage ? "error" : "ok"
      },
      metadata: {
        questionId: this.metadata.questionId,
        evaluationId: this.metadata.evaluationId,
        documentId: this.metadata.documentId
      }
    });
    await this.langfuse?.flush();
  }
}

const traceStorage = new AsyncLocalStorage<AgentTraceSession>();

export async function withAgentTrace<T>(
  metadata: AgentTraceMetadata,
  work: () => Promise<T>
): Promise<{ result: T; telemetry: PipelineTelemetry }> {
  const session = new AgentTraceSession(metadata);

  return traceStorage.run(session, async () => {
    try {
      const result = await work();
      await session.finalize();
      return { result, telemetry: session.toTelemetry() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await session.finalize(message);
      throw error;
    }
  });
}

export function startTracedStage(stage: string): string | undefined {
  return traceStorage.getStore()?.startStage(stage);
}

export function finishTracedStage(stageId: string | undefined, status: "ok" | "error", details: StageDetails = {}) {
  if (!stageId) {
    return;
  }

  traceStorage.getStore()?.finishStage(stageId, status, details);
}

class LangfuseClient {
  constructor(
    private readonly host: string,
    private readonly publicKey: string,
    private readonly secretKey: string
  ) {}

  createTrace(traceId: string, metadata: AgentTraceMetadata): void {
    void this.send([
      {
        id: crypto.randomUUID(),
        type: "trace-create",
        timestamp: new Date().toISOString(),
        body: {
          id: traceId,
          name: "filinglens-agent",
          input: {
            question: metadata.question,
            documentId: metadata.documentId
          },
          metadata: {
            questionId: metadata.questionId,
            evaluationId: metadata.evaluationId,
            saveTraces: metadata.saveTraces ?? true
          }
        }
      }
    ]);
  }

  createSpan(input: { spanId: string; traceId: string; name: string; input: Record<string, unknown> }): void {
    void this.send([
      {
        id: crypto.randomUUID(),
        type: "span-create",
        timestamp: new Date().toISOString(),
        body: {
          id: input.spanId,
          traceId: input.traceId,
          name: input.name,
          startTime: new Date().toISOString(),
          input: input.input
        }
      }
    ]);
  }

  endSpan(input: {
    spanId: string;
    traceId: string;
    output: Record<string, unknown>;
  }): void {
    void this.send([
      {
        id: crypto.randomUUID(),
        type: "span-update",
        timestamp: new Date().toISOString(),
        body: {
          id: input.spanId,
          traceId: input.traceId,
          endTime: new Date().toISOString(),
          output: input.output
        }
      }
    ]);
  }

  endTrace(input: { traceId: string; output: Record<string, unknown>; metadata: Record<string, Primitive | undefined> }) {
    void this.send([
      {
        id: crypto.randomUUID(),
        type: "trace-update",
        timestamp: new Date().toISOString(),
        body: {
          id: input.traceId,
          output: input.output,
          metadata: input.metadata
        }
      }
    ]);
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }

  private async send(events: unknown[]): Promise<void> {
    const body = JSON.stringify({ batch: events, metadata: { sdk: "my-ai-app" } });
    const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString("base64");

    try {
      const response = await fetch(`${this.host}/api/public/ingestion`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body
      });

      if (!response.ok) {
        logWarn("langfuse_ingestion_failed", { statusCode: response.status });
      }
    } catch (error) {
      logError("langfuse_ingestion_exception", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
}

function createLangfuseClient(): LangfuseClient | undefined {
  const enabled = process.env.LANGFUSE_ENABLED === "true";

  if (!enabled) {
    return undefined;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    logWarn("langfuse_disabled_missing_credentials");
    return undefined;
  }

  return new LangfuseClient(host, publicKey, secretKey);
}
