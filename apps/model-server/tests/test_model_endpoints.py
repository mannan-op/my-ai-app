import pytest
from fastapi.testclient import TestClient

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


class FakeModelRegistry:
    def get_table_qa_pipeline(self):
        return FakeTableQAPipeline()

    def get_nli_pipeline(self):
        return FakeNLIPipeline()


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
