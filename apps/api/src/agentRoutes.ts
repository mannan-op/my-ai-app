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

    const state = await runAgent(question, documentId);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

