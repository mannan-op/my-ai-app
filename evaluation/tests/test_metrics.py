from evaluation.metrics import (
    ParsedNumericValue,
    citation_accuracy_score,
    context_precision,
    numeric_accuracy,
    parse_numeric_value,
    retrieval_hit_rate,
)


def test_retrieval_hit_rate_success():
    assert retrieval_hit_rate(["chunk_1", "chunk_2"], ["chunk_2", "chunk_1", "chunk_3"]) == 1.0


def test_context_precision_partial():
    assert context_precision(["chunk_1"], ["chunk_1", "chunk_2", "chunk_3"]) == 1 / 3


def test_numeric_normalization_equivalence():
    assert numeric_accuracy("201.183 billion", "$201.183B", tolerance=0.0001) == 1.0
    assert numeric_accuracy("201.183 billion", "201183 million", tolerance=0.0001) == 1.0


def test_numeric_percentage_and_bps_equivalence():
    assert numeric_accuracy("1.25%", "125 bps", tolerance=0.0001) == 1.0


def test_parse_numeric_value():
    parsed = parse_numeric_value("$44.5 billion")
    assert parsed == ParsedNumericValue(value=44_500_000_000.0, unit="currency")


def test_citation_accuracy():
    score = citation_accuracy_score(
        citations=[
            {"chunkId": "chunk_1", "pageNumber": 7, "supports": ["fact_1"]},
            {"chunkId": "chunk_2", "pageNumber": 9, "supports": ["fact_missing"]},
        ],
        retrieved_chunks=[
            {"chunkId": "chunk_1", "pageNumber": 7, "content": "Revenue was 100 in 2024."},
            {"chunkId": "chunk_2", "pageNumber": 9, "content": "Operating income was 40."},
        ],
        extracted_facts=[
            {"id": "fact_1", "statement": "Revenue was 100 in 2024.", "value": 100},
        ],
    )
    assert score == 0.5

