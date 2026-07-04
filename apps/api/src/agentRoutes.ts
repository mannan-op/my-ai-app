import express from "express";
import { runAgent } from "./agents/index.js";

export const agentRouter = express.Router();

agentRouter.post("/ask", async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({
        error: "invalid_request",
        message: "Request body must be a JSON object."
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const question = typeof body.question === "string" ? body.question : "";
    const documentId = typeof body.document_id === "string" ? body.document_id : "";
    const topK = parseOptionalPositiveInteger(body.top_k, "top_k");
    const questionId = typeof body.question_id === "string" ? body.question_id : undefined;
    const evaluationId = typeof body.evaluation_id === "string" ? body.evaluation_id : undefined;
    const saveTraces = parseOptionalBoolean(body.save_traces, "save_traces");

    if (!question.trim()) {
      res.status(400).json({
        error: "invalid_request",
        message: "question is required."
      });
      return;
    }

    if (!documentId.trim()) {
      res.status(400).json({
        error: "invalid_request",
        message: "document_id is required."
      });
      return;
    }

    const state = await runAgent(question, documentId, {
      topK,
      questionId,
      evaluationId,
      saveTraces
    });
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
