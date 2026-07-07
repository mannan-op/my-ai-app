import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export type EvaluationRunStatus = {
  status: "idle" | "running" | "completed" | "failed";
  evaluation_id?: string;
  started_at?: string;
  finished_at?: string;
  error?: string;
};

const repoRoot = process.env.REPO_ROOT ?? path.join(process.cwd(), "../..");
const statusPath =
  process.env.EVAL_STATUS_PATH ?? path.join(repoRoot, "evaluation", ".run-status.json");
const pythonCommand = process.env.EVAL_PYTHON ?? "python";

let activeProcess: ChildProcess | null = null;

export async function readEvaluationStatus(): Promise<EvaluationRunStatus> {
  try {
    const raw = await fs.readFile(statusPath, "utf-8");
    return JSON.parse(raw) as EvaluationRunStatus;
  } catch {
    return { status: activeProcess ? "running" : "idle" };
  }
}

async function writeEvaluationStatus(status: EvaluationRunStatus): Promise<void> {
  await fs.mkdir(path.dirname(statusPath), { recursive: true });
  await fs.writeFile(statusPath, JSON.stringify(status, null, 2), "utf-8");
}

export async function startEvaluationRun(evaluationId?: string): Promise<EvaluationRunStatus> {
  const current = await readEvaluationStatus();

  if (current.status === "running" || activeProcess) {
    throw new Error("An evaluation run is already in progress.");
  }

  const runId = evaluationId?.trim() || `eval_${Date.now()}`;
  const startedAt = new Date().toISOString();

  await writeEvaluationStatus({
    status: "running",
    evaluation_id: runId,
    started_at: startedAt
  });

  activeProcess = spawn(pythonCommand, ["-m", "evaluation.evaluator"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      EVALUATION_ID: runId,
      EVAL_AGENT_URL: process.env.EVAL_AGENT_URL ?? "http://localhost:4000/agent/ask"
    }
  });

  activeProcess.on("exit", async (code) => {
    activeProcess = null;
    const finishedAt = new Date().toISOString();

    if (code === 0) {
      await writeEvaluationStatus({
        status: "completed",
        evaluation_id: runId,
        started_at: startedAt,
        finished_at: finishedAt
      });
      return;
    }

    await writeEvaluationStatus({
      status: "failed",
      evaluation_id: runId,
      started_at: startedAt,
      finished_at: finishedAt,
      error: `Evaluator exited with code ${code ?? "unknown"}`
    });
  });

  activeProcess.on("error", async (error) => {
    activeProcess = null;
    await writeEvaluationStatus({
      status: "failed",
      evaluation_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error.message
    });
  });

  return {
    status: "running",
    evaluation_id: runId,
    started_at: startedAt
  };
}

export function getEvaluationResultsPath(): string {
  return process.env.EVAL_RESULTS_PATH ?? path.join(repoRoot, "evaluation", "results.json");
}

export function getEvaluationReportPath(): string {
  return process.env.EVAL_REPORT_PATH ?? path.join(repoRoot, "evaluation", "report.md");
}
