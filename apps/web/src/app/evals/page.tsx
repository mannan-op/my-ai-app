"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock, Filter, Play, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { AppShell, PageHeader } from "../../components/shell";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { fetchEvaluationResults, fetchEvaluationStatus, startEvaluationRun } from "../../lib/api";
import { formatPercent } from "../../lib/format";
import { EvaluationExample, EvaluationResults, EvaluationRunStatus } from "../../lib/types";

function exampleStatus(example: EvaluationExample): "passed" | "failed" | "needs_review" {
  const score =
    (example.metrics.faithfulness +
      example.metrics.answer_relevancy +
      example.metrics.citation_accuracy +
      example.metrics.numeric_accuracy) /
    4;

  if (score >= 0.85) return "passed";
  if (score >= 0.7) return "needs_review";
  return "failed";
}

export default function EvalsPage() {
  const [results, setResults] = useState<EvaluationResults | null>(null);
  const [runStatus, setRunStatus] = useState<EvaluationRunStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingRun, setStartingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadResults = useCallback(async () => {
    const [nextResults, nextStatus] = await Promise.all([
      fetchEvaluationResults().catch(() => null),
      fetchEvaluationStatus().catch(() => ({ status: "idle" as const }))
    ]);
    setResults(nextResults);
    setRunStatus(nextStatus);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetchEvaluationResults().catch(() => null),
      fetchEvaluationStatus().catch(() => ({ status: "idle" as const }))
    ])
      .then(([nextResults, nextStatus]) => {
        if (!active) return;
        setResults(nextResults);
        setRunStatus(nextStatus);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (runStatus?.status !== "running") {
      return;
    }

    const interval = window.setInterval(async () => {
      const status = await fetchEvaluationStatus().catch(() => null);
      if (!status) return;

      setRunStatus(status);
      if (status.status === "completed") {
        await loadResults();
      }
      if (status.status === "failed") {
        setError(status.error ?? "Evaluation run failed.");
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadResults, runStatus?.status]);

  async function handleRunEvaluation() {
    setStartingRun(true);
    setError(null);

    try {
      const status = await startEvaluationRun();
      setRunStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start evaluation run.");
    } finally {
      setStartingRun(false);
    }
  }

  const examples = useMemo(() => results?.examples ?? [], [results]);
  const summary = results?.summary;

  const filtered = useMemo(() => {
    return examples.filter((example) => statusFilter === "all" || exampleStatus(example) === statusFilter);
  }, [examples, statusFilter]);

  const passCount = examples.filter((example) => exampleStatus(example) === "passed").length;
  const passRate = examples.length > 0 ? passCount / examples.length : 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Evaluation dashboard"
        title="Quality and regression checks"
        description="Track answer quality, retrieval coverage, citation grounding, verification behavior, and latency across evaluation runs."
        actions={
          <Button onClick={handleRunEvaluation} disabled={startingRun || runStatus?.status === "running"}>
            <Play size={16} />
            {startingRun || runStatus?.status === "running" ? "Running..." : "Run evaluation"}
          </Button>
        }
      />

      {runStatus?.status === "running" ? (
        <Card>
          <p className="muted">Evaluation {runStatus.evaluation_id ?? "run"} is in progress. Results refresh automatically when complete.</p>
        </Card>
      ) : null}

      {error ? <ErrorState message={`Could not load evaluation results: ${error}`} /> : null}

      {loading ? (
        <Card>
          <Skeleton lines={8} />
        </Card>
      ) : !summary || summary.total_questions === 0 ? (
        <Card>
          <EmptyState
            title="No evaluation run yet"
            description="Start a golden-set evaluation from here, or run `python -m evaluation.evaluator` from the repo root."
            action={
              <Button onClick={handleRunEvaluation} disabled={startingRun || runStatus?.status === "running"}>
                <Play size={16} />
                Run evaluation
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <section className="stat-grid">
            <Card className="metric-card">
              <span>Pass rate</span>
              <strong>{formatPercent(passRate)}</strong>
              <small>
                {passCount} of {examples.length} passed
              </small>
            </Card>
            <Card className="metric-card">
              <span>Avg latency</span>
              <strong>{Math.round(summary.average_latency_ms)} ms</strong>
              <small>Agent execution</small>
            </Card>
            <Card className="metric-card">
              <span>Citation quality</span>
              <strong>{formatPercent(summary.citation_accuracy)}</strong>
              <small>Structured references</small>
            </Card>
            <Card className="metric-card">
              <span>Answer quality</span>
              <strong>{formatPercent(summary.answer_relevancy)}</strong>
              <small>Verified response score</small>
            </Card>
          </section>

          <section className="dashboard-grid">
            <Card className="panel-large">
              <div className="section-title">
                <div>
                  <h2>Evaluation history</h2>
                  <p>
                    Run {results?.evaluation_id ?? "unknown"} with {summary.total_questions} golden-set questions.
                  </p>
                </div>
                <label className="select-control compact">
                  <Filter size={16} />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="passed">Passed</option>
                    <option value="needs_review">Needs review</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
              </div>

              <div className="eval-list">
                {filtered.map((example) => {
                  const status = exampleStatus(example);
                  const latencyMs = example.telemetry?.totalDurationMs ?? Math.round((example.runtime_seconds ?? 0) * 1000);

                  return (
                    <details key={example.id} className="eval-row">
                      <summary>
                        <span className="eval-title">
                          {status === "passed" ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                          {example.question}
                        </span>
                        <Badge tone={status === "passed" ? "green" : status === "failed" ? "red" : "amber"}>
                          {status.replace("_", " ")}
                        </Badge>
                        <span className="muted">{latencyMs} ms</span>
                      </summary>
                      <div className="eval-detail-grid">
                        <MetricBar label="Retrieval" value={example.metrics.retrieval_hit_rate} />
                        <MetricBar label="Citations" value={example.metrics.citation_accuracy} />
                        <MetricBar label="Answer" value={example.metrics.answer_relevancy} />
                      </div>
                    </details>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="section-title">
                <h2>Latency</h2>
                <Clock size={18} />
              </div>
              <div className="bar-list">
                {examples.slice(0, 8).map((example) => {
                  const latencyMs = example.telemetry?.totalDurationMs ?? Math.round((example.runtime_seconds ?? 0) * 1000);
                  return (
                    <div className="bar-row" key={example.id}>
                      <span>{example.id}</span>
                      <div>
                        <i style={{ width: `${Math.min(100, latencyMs / 25)}%` }} />
                      </div>
                      <strong>{latencyMs} ms</strong>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="section-title">
                <h2>Quality mix</h2>
                <BarChart3 size={18} />
              </div>
              <MetricBar label="Retrieval" value={summary.retrieval_hit_rate} />
              <MetricBar label="Citations" value={summary.citation_accuracy} />
              <MetricBar label="Answer" value={summary.answer_relevancy} />
            </Card>

            <Card>
              <div className="section-title">
                <h2>Filters</h2>
                <SlidersHorizontal size={18} />
              </div>
              <div className="chip-grid">
                <span className="chip">
                  Agent graph<strong>v1</strong>
                </span>
                <span className="chip">
                  Corpus<strong>{examples[0]?.document_id ?? "all"}</strong>
                </span>
                <span className="chip">
                  Verifier<strong>enabled</strong>
                </span>
                <span className="chip">
                  Citations<strong>required</strong>
                </span>
              </div>
            </Card>
          </section>
        </>
      )}
    </AppShell>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-bar">
      <div>
        <span>{label}</span>
        <strong>{Math.round(value * 100)}%</strong>
      </div>
      <div className="confidence-bar">
        <span style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
