from evaluation.config import EvaluationConfig
from evaluation.evaluator import (
    GoldenExample,
    aggregate_results,
    evaluate_example,
    generate_markdown_report,
    stage_latency_breakdown,
)


def test_evaluate_example_metrics():
    example = GoldenExample(
        id="test_001",
        document_id="doc_1",
        question="What was revenue in 2024?",
        expected_answer="100 billion",
        required_chunk_ids=["chunk_1"],
        required_page=12,
        answer_type="table_cell",
    )
    config = EvaluationConfig(numeric_tolerance=0.001)
    state = {
        "finalAnswer": "Revenue was $100B [C1]",
        "retrievedChunks": [
            {"chunkId": "chunk_1", "pageNumber": 12, "content": "Revenue was 100 billion."}
        ],
        "extractedFacts": [
            {"id": "fact_1", "statement": "Revenue was 100 billion.", "value": 100, "unit": "billion", "sourceChunkId": "chunk_1"}
        ],
        "citations": [{"chunkId": "chunk_1", "pageNumber": 12, "supports": ["fact_1"]}],
        "telemetry": {
            "totalDurationMs": 140,
            "stages": [{"stage": "planner", "durationMs": 20}, {"stage": "retriever", "durationMs": 40}],
        },
        "errors": [],
    }

    row = evaluate_example(example, state, config)
    assert row["metrics"]["retrieval_hit_rate"] == 1.0
    assert row["metrics"]["numeric_accuracy"] == 1.0
    assert row["metrics"]["citation_accuracy"] == 1.0


def test_aggregate_and_report():
    rows = [
        {
            "id": "a",
            "question": "Q1",
            "metrics": {
                "retrieval_hit_rate": 1.0,
                "context_precision": 0.8,
                "context_recall": 1.0,
                "faithfulness": 1.0,
                "answer_relevancy": 0.9,
                "citation_accuracy": 1.0,
                "numeric_accuracy": 1.0,
            },
            "telemetry": {"totalDurationMs": 100, "promptTokens": 10, "completionTokens": 20, "estimatedCostUsd": 0.001, "stages": []},
        },
        {
            "id": "b",
            "question": "Q2",
            "metrics": {
                "retrieval_hit_rate": 0.0,
                "context_precision": 0.2,
                "context_recall": 0.5,
                "faithfulness": 0.3,
                "answer_relevancy": 0.4,
                "citation_accuracy": 0.0,
                "numeric_accuracy": 0.0,
            },
            "telemetry": {"totalDurationMs": 300, "promptTokens": 5, "completionTokens": 10, "estimatedCostUsd": 0.002, "stages": []},
        },
    ]
    summary = aggregate_results(rows)
    assert summary["total_questions"] == 2
    assert summary["average_latency_ms"] == 200

    report = generate_markdown_report({"evaluation_id": "eval_x", "summary": summary, "examples": rows})
    assert "# Evaluation Report" in report
    assert "Failed retrievals" in report


def test_stage_latency_breakdown():
    examples = [
        {"telemetry": {"stages": [{"stage": "planner", "durationMs": 20}, {"stage": "retriever", "durationMs": 80}]}},
        {"telemetry": {"stages": [{"stage": "planner", "durationMs": 30}]}}
    ]
    breakdown = stage_latency_breakdown(examples)
    assert breakdown["planner"] == 25
    assert breakdown["retriever"] == 80

