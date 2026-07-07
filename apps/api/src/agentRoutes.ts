import express from "express";
import { runAgent, runAgentStream } from "./agents/index.js";
import type { AgentRuntimeOptions } from "./agents/state.js";

export const agentRouter = express.Router();

agentRouter.post("/ask", async (req, res, next) => {
  try {
    const input = parseAgentRequest(req.body);

    if ("error" in input) {
      res.status(400).json(input.error);
      return;
    }

    const state = await runAgent(input.question, input.documentId, input.options);
    res.json(state);
  } catch (error) {
    if (error instanceof Error && /must be/.test(error.message)) {
      res.status(400).json({
        error: "invalid_request",
        message: error.message
      });
      return;
    }

    next(error);
  }
});

agentRouter.post("/ask/stream", async (req, res, next) => {
  let closed = false;

  try {
    const input = parseAgentRequest(req.body);

    if ("error" in input) {
      res.status(400).json(input.error);
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    req.on("close", () => {
      closed = true;
    });

    await runAgentStream(input.question, input.documentId, input.options, (event) => {
      if (closed || res.writableEnded) {
        return;
      }

      res.write(`${JSON.stringify(event)}\n`);
    });
  } catch (error) {
    if (closedOrEnded(res)) {
      return;
    }

    if (error instanceof Error && /must be/.test(error.message)) {
      res.status(400).json({
        error: "invalid_request",
        message: error.message
      });
      return;
    }

    if (!res.headersSent) {
      next(error);
      return;
    }

    res.write(`${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Stream failed" })}\n`);
    res.end();
    return;
  }

  if (!closedOrEnded(res)) {
    res.end();
  }
});

function parseAgentRequest(body: unknown):
  | {
      question: string;
      documentId: string;
      options: AgentRuntimeOptions;
    }
  | { error: { error: string; message: string } } {
  if (!body || typeof body !== "object") {
    return {
      error: {
        error: "invalid_request",
        message: "Request body must be a JSON object."
      }
    };
  }

  const record = body as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question : "";
  const documentId = typeof record.document_id === "string" ? record.document_id : "";

  try {
    const topK = parseOptionalPositiveInteger(record.top_k, "top_k");
    const questionId = typeof record.question_id === "string" ? record.question_id : undefined;
    const evaluationId = typeof record.evaluation_id === "string" ? record.evaluation_id : undefined;
    const saveTraces = parseOptionalBoolean(record.save_traces, "save_traces");

    if (!question.trim()) {
      return {
        error: {
          error: "invalid_request",
          message: "question is required."
        }
      };
    }

    if (!documentId.trim()) {
      return {
        error: {
          error: "invalid_request",
          message: "document_id is required."
        }
      };
    }

    return {
      question,
      documentId,
      options: {
        topK,
        questionId,
        evaluationId,
        saveTraces
      }
    };
  } catch (error) {
    return {
      error: {
        error: "invalid_request",
        message: error instanceof Error ? error.message : "Invalid request body."
      }
    };
  }
}

function closedOrEnded(res: express.Response): boolean {
  return res.writableEnded || res.destroyed;
}

function parseOptionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer when provided.`);
  }

  return value;
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean when provided.`);
  }

  return value;
}
