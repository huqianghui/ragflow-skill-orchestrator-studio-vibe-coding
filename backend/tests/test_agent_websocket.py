"""Tests for agent WebSocket endpoint."""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.main import app


def _make_mock_session(session_id="test-session-123", agent_name="claude-code"):
    """Create a mock session object for WebSocket tests."""
    s = MagicMock()
    s.id = session_id
    s.agent_name = agent_name
    s.native_session_id = None
    s.title = "New Session"
    s.mode = "code"
    s.source = "playground"
    return s


@asynccontextmanager
async def _mock_db_session():
    """Fake AsyncSessionLocal context manager for WebSocket tests."""
    yield MagicMock()


@pytest.mark.asyncio
async def test_ws_session_not_found(client):
    """WebSocket should return error event when session is not found."""
    from starlette.testclient import TestClient

    with TestClient(app) as tc:
        with tc.websocket_connect("/api/v1/agents/sessions/nonexistent/ws") as ws:
            data = ws.receive_json()
            assert data["type"] == "error"
            assert "not found" in data["content"].lower()


@pytest.mark.asyncio
async def test_ws_connect_valid_session(client):
    """WebSocket should accept connection for valid session and handle messages."""
    mock_session = _make_mock_session()

    mock_events = [
        MagicMock(type="text", content="Hello from agent", metadata={}),
    ]

    async def mock_execute(request):
        for e in mock_events:
            yield e

    from starlette.testclient import TestClient

    with (
        patch("app.api.agents.session_proxy") as mock_sp,
        patch("app.api.agents.registry") as mock_registry,
        patch("app.api.agents.AsyncSessionLocal", side_effect=_mock_db_session),
    ):
        mock_sp.get = AsyncMock(return_value=mock_session)
        mock_sp.save_message = AsyncMock()
        mock_sp.update_native_id = AsyncMock()
        mock_sp.update_title = AsyncMock()

        mock_agent = MagicMock()
        mock_agent.execute = mock_execute
        mock_agent.extract_session_id.return_value = None
        mock_registry.get.return_value = mock_agent

        with TestClient(app) as tc:
            with tc.websocket_connect("/api/v1/agents/sessions/test-session-123/ws") as ws:
                ws.send_json(
                    {
                        "type": "message",
                        "content": "Hello",
                        "mode": "code",
                    }
                )
                # Should receive the agent event
                data = ws.receive_json()
                assert data["type"] == "text"
                assert data["content"] == "Hello from agent"

                # Should receive done event
                done = ws.receive_json()
                assert done["type"] == "done"


@pytest.mark.asyncio
async def test_ws_invalid_message_format(client):
    """WebSocket should return error for invalid message format."""
    mock_session = _make_mock_session()

    from starlette.testclient import TestClient

    with patch("app.api.agents.session_proxy") as mock_sp:
        mock_sp.get = AsyncMock(return_value=mock_session)

        with TestClient(app) as tc:
            with tc.websocket_connect("/api/v1/agents/sessions/test-session-123/ws") as ws:
                # Send non-message type (should be ignored)
                ws.send_json({"type": "ping"})
                # Send invalid message (missing required fields)
                ws.send_json({"type": "message"})
                data = ws.receive_json()
                assert data["type"] == "error"
                assert "invalid" in data["content"].lower()
