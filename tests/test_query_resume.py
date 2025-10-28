import os
import sys
import types

import pytest
from flask import Blueprint

os.environ.setdefault("SQLALCHEMY_DATABASE_URI", "sqlite:///:memory:")
os.environ.setdefault("VECTOR_STORE_PROVIDER", "pgvector")
os.environ.setdefault("FLASK_CONFIG", "development")

_dummy_selfquery = types.ModuleType("modules.selfquery")
_dummy_selfquery.selfquery_bp = Blueprint("selfquery", __name__)
sys.modules.setdefault("modules.selfquery", _dummy_selfquery)

from app import create_app
from extensions import db
from modules.database import MessageHistory, User
import modules.query as query_module


def _dummy_tiktoken_module():
    module = types.ModuleType("tiktoken")

    class _DummyEncoding:
        def encode(self, text):
            if not text:
                return []
            return [text]

    def get_encoding(name):
        return _DummyEncoding()

    module.get_encoding = get_encoding
    return module


@pytest.fixture(autouse=True)
def stub_tiktoken(monkeypatch):
    dummy_module = _dummy_tiktoken_module()
    monkeypatch.setitem(sys.modules, "tiktoken", dummy_module)
    monkeypatch.setattr(query_module, "tiktoken", dummy_module, raising=False)
    yield


@pytest.fixture
def app_instance():
    app = create_app()
    app.config.update(
        {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def user_id(app_instance):
    with app_instance.app_context():
        user = User(user_id="user-1", username="tester", auth_provider="local")
        db.session.add(user)
        db.session.commit()
        return user.user_id


@pytest.fixture
def client(app_instance, user_id):
    client = app_instance.test_client()
    with client.session_transaction() as session_data:
        session_data["_user_id"] = user_id
        session_data["_fresh"] = True
    return client


def _agent_payload(answer: str = "agent output") -> dict:
    return {
        "answer": answer,
        "citations": [
            {"document_id": "doc-1", "snippet": "example"},
        ],
        "usage_metadata": {"token_count": 10},
        "suggested_questions": ["next question?"],
        "structured_query": "structure",
    }


def test_api_query_non_stream_returns_message(client, app_instance, monkeypatch):
    agent_payload = _agent_payload("final answer")

    def fake_invoke_agent(*args, **kwargs):
        return dict(agent_payload)

    monkeypatch.setattr(query_module, "invoke_agent_via_worker", fake_invoke_agent)

    response = client.post(
        "/api/query",
        json={"query": "hello world", "stream": False, "conversation_id": "conv-123"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["answer"] == agent_payload["answer"]
    assert data["conversation_id"] == "conv-123"
    assert data["message_id"]

    with app_instance.app_context():
        stored = db.session.get(MessageHistory, data["message_id"])
        assert stored is not None
        assert stored.answer == agent_payload["answer"]
        assert stored.thread_id == "conv-123"


def test_api_query_streaming_updates_placeholder(client, app_instance, monkeypatch):
    agent_payload = _agent_payload("stream answer")

    def fake_invoke_agent(*args, **kwargs):
        return dict(agent_payload)

    def fail_invoke_agent_via_worker(*args, **kwargs):  # pragma: no cover - safety
        raise AssertionError("invoke_agent_via_worker should not be called for streaming")

    dummy_agent_module = types.ModuleType("modules.agent")
    dummy_agent_module.invoke_agent_graph = fake_invoke_agent
    monkeypatch.setitem(sys.modules, "modules.agent", dummy_agent_module)
    monkeypatch.setattr(query_module, "invoke_agent_via_worker", fail_invoke_agent_via_worker)

    response = client.post(
        "/api/query",
        json={"query": "stream please", "stream": True, "conversation_id": "conv-stream"},
    )

    assert response.status_code == 200
    body = b"".join(response.response).decode()
    assert "metadata_update" in body
    assert "end_of_stream" in body
    assert agent_payload["answer"] in body
    assert '"conversation_id": "conv-stream"' in body

    with app_instance.app_context():
        stored = (
            MessageHistory.query.filter_by(thread_id="conv-stream")
            .order_by(MessageHistory.message_id.desc())
            .first()
        )
        assert stored is not None
        assert stored.answer == agent_payload["answer"]


def test_api_resume_rag_non_stream_creates_message(client, app_instance, monkeypatch):
    resume_payload = _agent_payload("resume answer")

    def fake_resume_agent(*args, **kwargs):
        return dict(resume_payload)

    monkeypatch.setattr(query_module, "resume_agent_via_worker", fake_resume_agent)

    response = client.post(
        "/api/resume_rag",
        json={
            "thread_id": "thread-1",
            "confirmation": "yes",
            "stream": False,
            "conversation_id": "conv-1",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["answer"] == resume_payload["answer"]

    with app_instance.app_context():
        stored = MessageHistory.query.filter_by(answer=resume_payload["answer"]).first()
        assert stored is not None
        assert stored.thread_id == "thread-1"


def test_api_resume_rag_streaming_updates_placeholder(client, app_instance, monkeypatch):
    resume_payload = _agent_payload("resume stream answer")

    def fake_resume_agent(*args, **kwargs):
        return dict(resume_payload)

    monkeypatch.setattr(query_module, "resume_agent_via_worker", fake_resume_agent)

    response = client.post(
        "/api/resume_rag",
        json={
            "thread_id": "thread-stream",
            "confirmation": "yes",
            "stream": True,
            "conversation_id": "conv-stream",
        },
    )

    assert response.status_code == 200
    body = b"".join(response.response).decode()
    assert "metadata_update" in body
    assert "end_of_stream" in body
    assert resume_payload["answer"] in body

    with app_instance.app_context():
        stored = (
            MessageHistory.query.filter_by(thread_id="conv-stream")
            .order_by(MessageHistory.message_id.desc())
            .first()
        )
        assert stored is not None
        assert stored.answer == resume_payload["answer"]
