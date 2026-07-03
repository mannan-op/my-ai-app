import base64
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


class FakeTableQAPipeline:
    def __call__(self, table, query: str):
        if "older" in query.lower():
            age_values = table["Age"].astype(int)
            row = table.loc[age_values.idxmax()]
            return {"answer": row["Name"]}

        return {"answer": ""}


class FakeNLIPipeline:
    def __call__(self, inputs, truncation: bool, max_length: int):
        hypothesis = inputs["text_pair"].lower()

        if "sky is blue" in hypothesis:
            return [{"label": "ENTAILMENT", "score": 0.97}]

        if "sky is green" in hypothesis:
            return [{"label": "CONTRADICTION", "score": 0.96}]

        return [{"label": "NEUTRAL", "score": 0.72}]


class FakeLayoutDocumentQAPipeline:
    def __call__(self, image, question: str):
        return [{"answer": "Total revenue", "score": 0.88}]


class FakeVisionQAPipeline:
    def __call__(self, image, question: str):
        return [{"answer": "blue", "score": 0.91}]


class FakeSectionClassifierPipeline:
    def __call__(self, text: str, candidate_labels: list[str], truncation: bool, max_length: int):
        label = "risk factors" if "risk" in text.lower() else candidate_labels[0]
        return {"labels": [label, "other"], "scores": [0.93, 0.07]}


class FakeModelRegistry:
    def get_table_qa_pipeline(self):
        return FakeTableQAPipeline()

    def get_nli_pipeline(self):
        return FakeNLIPipeline()

    def get_layout_document_qa_pipeline(self):
        return FakeLayoutDocumentQAPipeline()

    def get_vision_qa_pipeline(self):
        return FakeVisionQAPipeline()

    def get_section_classifier_pipeline(self):
        return FakeSectionClassifierPipeline()


@pytest.fixture
def test_client():
    with TestClient(app) as test_client:
        test_client.app.state.model_registry = FakeModelRegistry()
        yield test_client


def test_table_qa_valid_table(test_client):
    response = test_client.post(
        "/table/qa",
        json={
            "table": [
                {"Name": "Alice", "Age": "24"},
                {"Name": "Bob", "Age": "31"},
            ],
            "question": "Who is older?",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"answer": "Bob"}


def test_table_qa_invalid_table(test_client):
    response = test_client.post(
        "/table/qa",
        json={
            "table": [
                {"Name": "Alice", "Age": "24"},
                {"Name": "Bob"},
            ],
            "question": "Who is older?",
        },
    )

    assert response.status_code == 400
    assert "same columns" in response.json()["detail"]


def test_table_qa_empty_table(test_client):
    response = test_client.post(
        "/table/qa",
        json={"table": [], "question": "Who is older?"},
    )

    assert response.status_code == 422


def test_table_qa_malformed_request(test_client):
    response = test_client.post("/table/qa", json={"question": "Who is older?"})

    assert response.status_code == 422


def test_nli_entailment(test_client):
    response = test_client.post(
        "/verify/nli",
        json={
            "premise": "On clear days, the sky appears blue.",
            "hypothesis": "The sky is blue.",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"label": "ENTAILMENT", "score": 0.97}


def test_nli_contradiction(test_client):
    response = test_client.post(
        "/verify/nli",
        json={
            "premise": "On clear days, the sky appears blue.",
            "hypothesis": "The sky is green.",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"label": "CONTRADICTION", "score": 0.96}


def test_nli_neutral(test_client):
    response = test_client.post(
        "/verify/nli",
        json={
            "premise": "The company reported revenue growth.",
            "hypothesis": "The company opened a new office.",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"label": "NEUTRAL", "score": 0.72}


def test_nli_malformed_request(test_client):
    response = test_client.post("/verify/nli", json={"premise": "Evidence only."})

    assert response.status_code == 422


def test_layout_document_qa_valid_image(test_client):
    response = test_client.post(
        "/layout/document-qa",
        json={
            "image_base64": sample_image_base64(),
            "question": "What field is shown?",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"answer": "Total revenue", "score": 0.88}


def test_layout_document_qa_invalid_image(test_client):
    response = test_client.post(
        "/layout/document-qa",
        json={
            "image_base64": "not-an-image",
            "question": "What field is shown?",
        },
    )

    assert response.status_code == 400
    assert "base64" in response.json()["detail"]


def test_vision_qa_valid_image(test_client):
    response = test_client.post(
        "/vision/qa",
        json={
            "image_base64": sample_image_base64(),
            "question": "What color is the image?",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"answer": "blue", "score": 0.91}


def test_vision_qa_malformed_request(test_client):
    response = test_client.post(
        "/vision/qa",
        json={"image_base64": sample_image_base64()},
    )

    assert response.status_code == 422


def test_classify_section_default_labels(test_client):
    response = test_client.post(
        "/classify/section",
        json={"text": "The company faces market and liquidity risk."},
    )

    assert response.status_code == 200
    assert response.json() == {"label": "risk factors", "score": 0.93}


def test_classify_section_custom_labels(test_client):
    response = test_client.post(
        "/classify/section",
        json={
            "text": "Revenue and cash flow are shown below.",
            "candidate_labels": ["financial statements", "legal proceedings"],
        },
    )

    assert response.status_code == 200
    assert response.json() == {"label": "financial statements", "score": 0.93}


def test_classify_section_malformed_request(test_client):
    response = test_client.post(
        "/classify/section",
        json={"candidate_labels": ["risk factors"]},
    )

    assert response.status_code == 422


def sample_image_base64() -> str:
    image = Image.new("RGB", (2, 2), color="blue")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")
