from __future__ import annotations

import json
import statistics
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import EvaluationConfig, load_evaluation_config
from .metrics import (
    answer_relevancy_score,
    citation_accuracy_score,
    context_precision,
    context_recall,
    faithfulness_score,
    numeric_accuracy,
    retrieval_hit_rate,
)


@dataclass(frozen=True)
class GoldenExample:
    id: str
    document_id: str
    question: str
    expected_answer: str
    required_chunk_ids: list[str]
    required_page: int | None
    answer_type: str


def load_golden_dataset(path: str | Path = "evaluation/golden_dataset.jsonl") -> list[GoldenExample]:
    items: list[GoldenExample] = []
    for raw_line in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        payload = json.loads(line)
        items.append(
            GoldenExample(
                id=str(payload["id"]),
                document_id=str(payload["document_id"]),
                question=str(payload["question"]),
                expected_answer=str(payload["expected_answer"]),
                required_chunk_ids=[str(chunk_id) for chunk_id in payload.get("required_chunk_ids", [])],
                required_page=int(payload["required_page"]) if payload.get("required_page") is not None else None,
                answer_type=str(payload["answer_type"]),
            )
        )
    return items


def run_evaluation(
    config: EvaluationConfig,
    dataset: list[GoldenExample],
    evaluation_id: str | None = None,
) -> dict[str, Any]:
    run_id = evaluation_id or f"eval_{int(time.time())}"
    rows: list[dict[str, Any]] = []

    for example in dataset:
        started = time.perf_counter()
        try:
            pipeline_state = invoke_pipeline(config, example, run_id)
            row = evaluate_example(example, pipeline_state, config)
        except Exception as exc:
            row = {
                "id": example.id,
                "document_id": example.document_id,
                "question": example.question,
                "expected_answer": example.expected_answer,
                "predicted_answer": "",
                "error": str(exc),
                "metrics": {
                    "retrieval_hit_rate": 0.0,
                    "context_precision": 0.0,
                    "context_recall": 0.0,
                    "faithfulness": 0.0,
                    "answer_relevancy": 0.0,
                    "citation_accuracy": 0.0,
                    "numeric_accuracy": 0.0,
                },
                "telemetry": {"totalDurationMs": 0, "stages": []},
            }
        row["runtime_seconds"] = round(time.perf_counter() - started, 4)
        rows.append(row)

    aggregate = aggregate_results(rows)
    return {
        "evaluation_id": run_id,
        "config": config.__dict__,
        "summary": aggregate,
        "examples": rows,
    }


def invoke_pipeline(config: EvaluationConfig, example: GoldenExample, evaluation_id: str) -> dict[str, Any]:
    payload = {
        "document_id": example.document_id,
        "question": example.question,
        "top_k": config.top_k,
        "question_id": example.id,
        "evaluation_id": evaluation_id,
        "save_traces": config.save_traces,
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        config.agent_url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=config.request_timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Pipeline request failed with HTTP {exc.code}: {error_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Pipeline request failed: {exc.reason}") from exc


def evaluate_example(
    example: GoldenExample,
    pipeline_state: dict[str, Any],
    config: EvaluationConfig,
) -> dict[str, Any]:
    retrieved_chunks = pipeline_state.get("retrievedChunks", [])
    extracted_facts = pipeline_state.get("extractedFacts", [])
    citations = pipeline_state.get("citations", [])
    telemetry = pipeline_state.get("telemetry", {})
    predicted_answer = str(pipeline_state.get("finalAnswer") or "")

    retrieved_ids = [str(chunk.get("chunkId")) for chunk in retrieved_chunks if chunk.get("chunkId") is not None]
    metrics = {
        "retrieval_hit_rate": retrieval_hit_rate(example.required_chunk_ids, retrieved_ids),
        "context_precision": context_precision(example.required_chunk_ids, retrieved_ids),
        "context_recall": context_recall(example.required_chunk_ids, retrieved_ids),
        "faithfulness": faithfulness_score(predicted_answer, extracted_facts, config.numeric_tolerance),
        "answer_relevancy": answer_relevancy_score(example.question, predicted_answer),
        "citation_accuracy": citation_accuracy_score(citations, retrieved_chunks, extracted_facts),
        "numeric_accuracy": numeric_accuracy(
            example.expected_answer,
            predicted_answer,
            config.numeric_tolerance,
        ),
    }

    return {
        "id": example.id,
        "document_id": example.document_id,
        "question": example.question,
        "expected_answer": example.expected_answer,
        "predicted_answer": predicted_answer,
        "answer_type": example.answer_type,
        "required_page": example.required_page,
        "required_chunk_ids": example.required_chunk_ids,
        "retrieved_chunk_ids": retrieved_ids,
        "retrieved_pages": [chunk.get("pageNumber") for chunk in retrieved_chunks],
        "metrics": metrics,
        "telemetry": telemetry,
        "errors": pipeline_state.get("errors", []),
    }


def aggregate_results(rows: list[dict[str, Any]]) -> dict[str, Any]:
    metric_names = [
        "retrieval_hit_rate",
        "context_precision",
        "context_recall",
        "faithfulness",
        "answer_relevancy",
        "citation_accuracy",
        "numeric_accuracy",
    ]

    averages = {
        name: _safe_mean(row.get("metrics", {}).get(name, 0.0) for row in rows)
        for name in metric_names
    }

    latency_ms = [float(row.get("telemetry", {}).get("totalDurationMs", 0.0)) for row in rows]
    prompt_tokens = [int(row.get("telemetry", {}).get("promptTokens", 0)) for row in rows]
    completion_tokens = [int(row.get("telemetry", {}).get("completionTokens", 0)) for row in rows]
    total_cost = sum(float(row.get("telemetry", {}).get("estimatedCostUsd", 0.0)) for row in rows)

    return {
        **averages,
        "total_questions": len(rows),
        "average_latency_ms": _safe_mean(latency_ms),
        "average_prompt_tokens": _safe_mean(prompt_tokens),
        "average_completion_tokens": _safe_mean(completion_tokens),
        "average_cost_usd": total_cost / len(rows) if rows else 0.0,
        "total_cost_usd": total_cost,
    }


def generate_markdown_report(results: dict[str, Any]) -> str:
    summary = results["summary"]
    examples = results["examples"]
    failed_retrievals = [
        ex for ex in examples if ex["metrics"]["retrieval_hit_rate"] < 1.0
    ]
    hallucinated_citations = [
        ex for ex in examples if ex["metrics"]["citation_accuracy"] < 1.0
    ]
    numeric_mismatches = [
        ex for ex in examples if ex["metrics"]["numeric_accuracy"] < 1.0
    ]
    worst_examples = sorted(
        examples,
        key=lambda ex: (
            ex["metrics"]["faithfulness"]
            + ex["metrics"]["answer_relevancy"]
            + ex["metrics"]["numeric_accuracy"]
        ),
    )[:10]

    lines = [
        "# Evaluation Report",
        "",
        f"Evaluation ID: `{results['evaluation_id']}`",
        "",
        f"Total Questions: {summary['total_questions']}",
        "",
        f"Retrieval Hit Rate: {_percent(summary['retrieval_hit_rate'])}",
        f"Context Precision: {_percent(summary['context_precision'])}",
        f"Context Recall: {_percent(summary['context_recall'])}",
        f"Faithfulness: {_percent(summary['faithfulness'])}",
        f"Answer Relevancy: {_percent(summary['answer_relevancy'])}",
        f"Citation Accuracy: {_percent(summary['citation_accuracy'])}",
        f"Numeric Accuracy: {_percent(summary['numeric_accuracy'])}",
        f"Average Latency: {summary['average_latency_ms'] / 1000:.2f}s",
        f"Average Cost: ${summary['average_cost_usd']:.6f}",
        "",
        "## Worst-performing examples",
        "",
    ]

    if not worst_examples:
        lines.append("- None")
    else:
        lines.extend(
            f"- `{ex['id']}` score={_worst_score(ex):.3f} question={ex['question']}"
            for ex in worst_examples
        )

    lines.extend(
        [
            "",
            "## Failed retrievals",
            "",
            *_example_lines(failed_retrievals),
            "",
            "## Hallucinated citations",
            "",
            *_example_lines(hallucinated_citations),
            "",
            "## Numeric mismatches",
            "",
            *_example_lines(numeric_mismatches),
            "",
            "## Latency breakdown",
            "",
        ]
    )

    latency_breakdown = stage_latency_breakdown(examples)
    if not latency_breakdown:
        lines.append("- No stage telemetry available")
    else:
        for stage_name, avg_ms in sorted(latency_breakdown.items()):
            lines.append(f"- {stage_name}: {avg_ms:.2f}ms")

    return "\n".join(lines).strip() + "\n"


def stage_latency_breakdown(examples: list[dict[str, Any]]) -> dict[str, float]:
    stage_map: dict[str, list[float]] = {}
    for example in examples:
        stages = example.get("telemetry", {}).get("stages", [])
        if not isinstance(stages, list):
            continue

        for stage in stages:
            name = str(stage.get("stage", ""))
            duration = stage.get("durationMs", 0)
            if not name or not isinstance(duration, (int, float)):
                continue
            stage_map.setdefault(name, []).append(float(duration))

    return {name: _safe_mean(values) for name, values in stage_map.items()}


def write_outputs(results: dict[str, Any], report_markdown: str, output_directory: str | Path) -> None:
    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)
    (output_path / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (output_path / "report.md").write_text(report_markdown, encoding="utf-8")


def main() -> None:
    config = load_evaluation_config()
    dataset = load_golden_dataset()
    results = run_evaluation(config, dataset)
    report = generate_markdown_report(results)
    write_outputs(results, report, config.report_directory)


def _percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def _safe_mean(values: Any) -> float:
    values_list = list(values)
    return statistics.fmean(values_list) if values_list else 0.0


def _example_lines(examples: list[dict[str, Any]]) -> list[str]:
    if not examples:
        return ["- None"]

    return [
        f"- `{example['id']}`: {example['question']}"
        for example in examples[:15]
    ]


def _worst_score(example: dict[str, Any]) -> float:
    metrics = example["metrics"]
    return (
        metrics["faithfulness"] + metrics["answer_relevancy"] + metrics["numeric_accuracy"]
    ) / 3


if __name__ == "__main__":
    main()

