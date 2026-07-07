import fs from "node:fs/promises";
import express from "express";
import {
  getEvaluationReportPath,
  getEvaluationResultsPath,
  readEvaluationStatus,
  startEvaluationRun
} from "./evaluationRunner.js";

export const evaluationRouter = express.Router();

evaluationRouter.get("/results", async (_req, res) => {
  try {
    const raw = await fs.readFile(getEvaluationResultsPath(), "utf-8");
    res.type("application/json").send(raw);
  } catch {
    res.status(404).json({
      error: "results_not_found",
      message: "Evaluation results are not available yet."
    });
  }
});

evaluationRouter.get("/report", async (_req, res) => {
  try {
    const markdown = await fs.readFile(getEvaluationReportPath(), "utf-8");
    res.type("text/markdown").send(markdown);
  } catch {
    res.status(404).json({
      error: "report_not_found",
      message: "Evaluation report is not available yet."
    });
  }
});

evaluationRouter.get("/status", async (_req, res) => {
  const status = await readEvaluationStatus();
  res.json(status);
});

evaluationRouter.post("/run", async (req, res) => {
  try {
    const evaluationId =
      req.body && typeof req.body === "object" && typeof req.body.evaluation_id === "string"
        ? req.body.evaluation_id
        : undefined;

    const status = await startEvaluationRun(evaluationId);
    res.status(202).json(status);
  } catch (error) {
    if (error instanceof Error && error.message.includes("already in progress")) {
      res.status(409).json({
        error: "evaluation_running",
        message: error.message
      });
      return;
    }

    if (error instanceof Error && /spawn|ENOENT/i.test(error.message)) {
      res.status(503).json({
        error: "evaluator_unavailable",
        message: "Python evaluator is not available in this environment. Run `python -m evaluation.evaluator` manually."
      });
      return;
    }

    res.status(500).json({
      error: "evaluation_start_failed",
      message: error instanceof Error ? error.message : "Could not start evaluation run."
    });
  }
});
