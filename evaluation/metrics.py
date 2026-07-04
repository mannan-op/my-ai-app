from __future__ import annotations

import math
import re
from dataclasses import dataclass


NUMBER_RE = re.compile(r"[-+]?\d+(?:,\d{3})*(?:\.\d+)?")
TOKEN_RE = re.compile(r"[a-z0-9_]+")
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "were",
    "what",
    "which",
    "with",
}


@dataclass(frozen=True)
class ParsedNumericValue:
    value: float
    unit: str | None


def retrieval_hit_rate(required_chunk_ids: list[str], retrieved_chunk_ids: list[str]) -> float:
    if not required_chunk_ids:
        return 1.0

    retrieved = set(retrieved_chunk_ids)
    return 1.0 if set(required_chunk_ids).issubset(retrieved) else 0.0


def context_precision(required_chunk_ids: list[str], retrieved_chunk_ids: list[str]) -> float:
    if not retrieved_chunk_ids:
        return 0.0

    required = set(required_chunk_ids)
    useful = sum(1 for chunk_id in retrieved_chunk_ids if chunk_id in required)
    return useful / len(retrieved_chunk_ids)


def context_recall(required_chunk_ids: list[str], retrieved_chunk_ids: list[str]) -> float:
    if not required_chunk_ids:
        return 1.0

    required = set(required_chunk_ids)
    retrieved = set(retrieved_chunk_ids)
    matched = len(required.intersection(retrieved))
    return matched / len(required)


def answer_relevancy_score(question: str, answer: str) -> float:
    question_tokens = _keywords(question)
    answer_tokens = _keywords(answer)

    if not question_tokens:
        return 0.0

    overlap = len(question_tokens.intersection(answer_tokens))
    return overlap / len(question_tokens)


def citation_accuracy_score(
    citations: list[dict[str, object]],
    retrieved_chunks: list[dict[str, object]],
    extracted_facts: list[dict[str, object]],
) -> float:
    if not citations:
        return 0.0

    chunk_by_id = {
        str(chunk.get("chunkId")): chunk
        for chunk in retrieved_chunks
        if chunk.get("chunkId") is not None
    }
    fact_by_id = {
        str(fact.get("id")): fact
        for fact in extracted_facts
        if fact.get("id") is not None
    }

    valid = 0
    for citation in citations:
        chunk_id = str(citation.get("chunkId", ""))
        cited_page = citation.get("pageNumber")
        supports = citation.get("supports", [])

        if not isinstance(supports, list):
            continue

        chunk = chunk_by_id.get(chunk_id)
        if chunk is None:
            continue

        if chunk.get("pageNumber") != cited_page:
            continue

        if not _citation_supports_facts(supports, fact_by_id, str(chunk.get("content", ""))):
            continue

        valid += 1

    return valid / len(citations)


def faithfulness_score(answer: str, extracted_facts: list[dict[str, object]], tolerance: float) -> float:
    answer_numbers = [parse_numeric_token(m.group(0)) for m in NUMBER_RE.finditer(answer)]
    answer_numbers = [n for n in answer_numbers if n is not None]

    if not answer_numbers:
        return 1.0 if extracted_facts else 0.0

    fact_numbers: list[ParsedNumericValue] = []
    for fact in extracted_facts:
        raw_value = fact.get("value")
        if isinstance(raw_value, (int, float)):
            unit = str(fact.get("unit")) if fact.get("unit") is not None else None
            normalized_unit = _normalize_unit(unit)
            scale = _unit_scale(normalized_unit)
            fact_numbers.append(
                ParsedNumericValue(value=float(raw_value) * scale, unit=normalized_unit)
            )

    if not fact_numbers:
        return 0.0

    supported = 0
    for answer_number in answer_numbers:
        if any(
            numeric_equivalent_values(answer_number, fact_number, tolerance)
            for fact_number in fact_numbers
        ):
            supported += 1

    return supported / len(answer_numbers)


def numeric_accuracy(
    expected_answer: str,
    predicted_answer: str,
    tolerance: float,
) -> float:
    expected = parse_numeric_value(expected_answer)
    predicted = parse_numeric_value(predicted_answer)

    if expected is None:
        return 1.0 if _normalize_text(expected_answer) in _normalize_text(predicted_answer) else 0.0
    if predicted is None:
        return 0.0

    return 1.0 if numeric_equivalent_values(expected, predicted, tolerance) else 0.0


def parse_numeric_value(text: str) -> ParsedNumericValue | None:
    return parse_numeric_token(text.strip())


def parse_numeric_token(token: str) -> ParsedNumericValue | None:
    number_match = NUMBER_RE.search(token)
    if not number_match:
        return None

    number = float(number_match.group(0).replace(",", ""))
    suffix_text = token[number_match.end() :].strip().lower()
    unit = _extract_unit(suffix_text, token.lower())
    scale = _magnitude_scale(suffix_text) * _unit_scale(unit)
    return ParsedNumericValue(value=number * scale, unit=unit)


def numeric_equivalent_values(
    left: ParsedNumericValue,
    right: ParsedNumericValue,
    tolerance: float,
) -> bool:
    if left.unit and right.unit and left.unit != right.unit:
        if {left.unit, right.unit} == {"percent", "bps"}:
            pass
        else:
            return False

    max_abs = max(abs(left.value), abs(right.value), 1.0)
    return math.isclose(left.value, right.value, rel_tol=tolerance, abs_tol=tolerance * max_abs)


def _extract_unit(suffix: str, full_text: str) -> str | None:
    if "%" in full_text or " percent" in full_text:
        return "percent"
    if "bp" in suffix or "basis point" in suffix:
        return "bps"
    if "$" in full_text or "usd" in suffix or "dollar" in suffix:
        return "currency"
    return None


def _unit_scale(unit: str | None) -> float:
    if unit == "bps":
        return 0.01
    return 1.0


def _magnitude_scale(suffix: str) -> float:
    if "billion" in suffix or re.search(r"\bb\b", suffix):
        return 1_000_000_000
    if "million" in suffix or re.search(r"\bm\b", suffix):
        return 1_000_000
    return 1.0


def _keywords(text: str) -> set[str]:
    return {
        token
        for token in TOKEN_RE.findall(text.lower())
        if token not in STOPWORDS and len(token) > 1
    }


def _citation_supports_facts(
    supported_ids: list[object],
    fact_by_id: dict[str, dict[str, object]],
    chunk_content: str,
) -> bool:
    normalized_chunk = _normalize_text(chunk_content)
    if not supported_ids:
        return False

    for supported_id in supported_ids:
        fact = fact_by_id.get(str(supported_id))
        if fact is None:
            return False

        statement = str(fact.get("statement", ""))
        if statement:
            statement_tokens = _keywords(statement)
            if statement_tokens and len(statement_tokens.intersection(_keywords(normalized_chunk))) == 0:
                return False

    return True


def _normalize_text(text: str) -> str:
    return " ".join(text.lower().split())


def _normalize_unit(unit: str | None) -> str | None:
    if unit is None:
        return None
    normalized = unit.lower()
    if normalized in {"percent", "%"}:
        return "percent"
    if normalized in {"currency", "usd", "$"}:
        return "currency"
    if normalized in {"basis_points", "bps", "bp"}:
        return "bps"
    return normalized
