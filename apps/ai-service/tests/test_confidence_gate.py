import json

from langgraph.graph import END

from app.domain.classification.models import JobClassificationDraft
from app.graphs.classification.nodes import (
    confidence_gate_node,
    extract_json_block,
)


def _draft(**kwargs: object) -> JobClassificationDraft:
    return JobClassificationDraft(**kwargs)


def test_missing_parsed_routes_to_end() -> None:
    command = confidence_gate_node({"attempts": 0})
    assert command.goto == END


def test_attempt_ceiling_routes_to_end() -> None:
    command = confidence_gate_node(
        {"parsed": _draft(category_slug="plumbing", confidence=0.1), "attempts": 2}
    )
    assert command.goto == END


def test_confident_categorised_draft_is_accepted() -> None:
    command = confidence_gate_node(
        {
            "parsed": _draft(category_slug="plumbing", confidence=0.8),
            "attempts": 1,
        }
    )
    assert command.goto == END


def test_low_confidence_retries_with_a_hint() -> None:
    command = confidence_gate_node(
        {
            "parsed": _draft(category_slug="plumbing", confidence=0.5),
            "attempts": 1,
        }
    )
    assert command.goto == "call_model"
    hint = command.update["retry_hint"]
    assert "plumbing" in hint
    assert "0.50" in hint


def test_high_confidence_without_category_retries() -> None:
    command = confidence_gate_node(
        {
            "parsed": _draft(category_slug=None, confidence=0.95),
            "attempts": 1,
        }
    )
    assert command.goto == "call_model"
    assert "no category" in command.update["retry_hint"]


def test_extract_json_from_fenced_block() -> None:
    raw = '```json\n{"category_slug": "plumbing", "confidence": 0.8}\n```'
    payload = json.loads(extract_json_block(raw))
    assert payload["category_slug"] == "plumbing"


def test_extract_json_from_prose() -> None:
    raw = 'Sure! Here is the result: {"confidence": 0.4} — hope that helps.'
    payload = json.loads(extract_json_block(raw))
    assert payload["confidence"] == 0.4


def test_extract_json_without_braces_falls_back() -> None:
    payload = json.loads(extract_json_block("no json here at all"))
    assert payload["category_slug"] is None
    assert "did not return a JSON object" in payload["reasoning_summary"]
