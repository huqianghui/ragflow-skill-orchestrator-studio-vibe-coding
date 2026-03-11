"""Tests for DocumentCracker built-in skill — covers HTTP call paths with mock httpx."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.builtin_skills.doc_skills import (  # noqa: I001
    DocumentCrackerSkill,
    _retry_request,
    _to_relative_url,
)
from app.services.builtin_skills.runner import BuiltinSkillRunner

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_client(base_url="https://test.cognitiveservices.azure.com"):
    """Create a mock httpx.Client with base_url attribute."""
    client = MagicMock()
    client.base_url = base_url
    return client


def _make_response(status_code=200, json_data=None, headers=None):
    """Create a mock httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    resp.headers = headers or {}
    resp.raise_for_status = MagicMock()
    return resp


# ---------------------------------------------------------------------------
# _to_relative_url
# ---------------------------------------------------------------------------


class TestToRelativeUrl:
    def test_absolute_url_to_relative(self):
        url = (
            "https://eastus.api.cognitive.microsoft.com"
            "/documentintelligence/operations/abc123?api-version=2024-11-30"
        )
        result = _to_relative_url(url, "https://eastus.api.cognitive.microsoft.com")
        assert result == "/documentintelligence/operations/abc123?api-version=2024-11-30"

    def test_absolute_url_no_query(self):
        url = "https://example.com/path/to/resource"
        result = _to_relative_url(url, "https://example.com")
        assert result == "/path/to/resource"

    def test_already_relative(self):
        url = "/documentintelligence/operations/abc123"
        result = _to_relative_url(url, "https://example.com")
        assert result == "/documentintelligence/operations/abc123"


# ---------------------------------------------------------------------------
# _retry_request
# ---------------------------------------------------------------------------


class TestRetryRequest:
    def test_success_no_retry(self):
        func = MagicMock(return_value="ok")
        result = _retry_request(func, "arg1", key="val")
        assert result == "ok"
        func.assert_called_once_with("arg1", key="val")

    def test_retries_on_connection_error(self):
        func = MagicMock(side_effect=[ConnectionError("reset"), "ok"])
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = _retry_request(func)
        assert result == "ok"
        assert func.call_count == 2

    def test_retries_on_connection_reset(self):
        func = MagicMock(side_effect=[ConnectionResetError("peer"), "ok"])
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = _retry_request(func)
        assert result == "ok"
        assert func.call_count == 2

    def test_exhausts_retries_raises(self):
        func = MagicMock(
            side_effect=[ConnectionError("1"), ConnectionError("2"), ConnectionError("3")]
        )
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            with pytest.raises(ConnectionError):
                _retry_request(func)
        assert func.call_count == 3

    def test_non_transient_error_no_retry(self):
        func = MagicMock(side_effect=ValueError("bad input"))
        with pytest.raises(ValueError, match="bad input"):
            _retry_request(func)
        func.assert_called_once()


# ---------------------------------------------------------------------------
# DocumentCrackerSkill — text passthrough
# ---------------------------------------------------------------------------


class TestDocumentCrackerPassthrough:
    def test_text_passthrough(self):
        skill = DocumentCrackerSkill()
        result = skill.execute({"text": "hello"}, {}, None)
        assert result["text"] == "hello"

    def test_no_content_no_text(self):
        skill = DocumentCrackerSkill()
        result = skill.execute({}, {}, None)
        assert result["text"] == ""
        assert "error" in result


# ---------------------------------------------------------------------------
# DocumentCrackerSkill — Doc Intelligence (prebuilt-layout)
# ---------------------------------------------------------------------------


class TestDocIntelligence:
    def test_sync_200_response(self):
        """Doc Intelligence returns 200 directly (small doc)."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={
                "analyzeResult": {
                    "content": "# Title\n\nBody text",
                    "pages": [{"pageNumber": 1, "width": 8.5, "height": 11, "unit": "inch"}],
                    "tables": [],
                    "figures": [],
                }
            },
        )

        skill = DocumentCrackerSkill()
        result = skill.execute(
            {"file_content": b"fake-pdf", "_connection_type": "azure_doc_intelligence"},
            {},
            client,
        )

        assert result["text"] == "# Title\n\nBody text"
        assert result["markdown"] == "# Title\n\nBody text"
        assert result["metadata"]["pageCount"] == 1
        assert len(result["pages"]) == 1

    def test_async_202_poll_success(self):
        """Doc Intelligence returns 202, then poll succeeds."""
        client = _make_mock_client()

        # Initial POST returns 202
        post_resp = _make_response(
            202,
            headers={
                "Operation-Location": (
                    "https://test.cognitiveservices.azure.com"
                    "/documentintelligence/operations/op123?api-version=2024-11-30"
                )
            },
        )
        client.post.return_value = post_resp

        # Poll: first "running", then "succeeded"
        poll_running = _make_response(200, json_data={"status": "running"})
        poll_done = _make_response(
            200,
            json_data={
                "status": "succeeded",
                "analyzeResult": {
                    "content": "Parsed markdown content",
                    "pages": [
                        {"pageNumber": 1, "width": 8.5, "height": 11, "unit": "inch"},
                        {"pageNumber": 2, "width": 8.5, "height": 11, "unit": "inch"},
                    ],
                    "tables": [],
                    "figures": [],
                },
            },
        )
        client.get.side_effect = [poll_running, poll_done]

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = skill.execute(
                {"file_content": b"fake-pdf", "_connection_type": "azure_doc_intelligence"},
                {},
                client,
            )

        assert result["text"] == "Parsed markdown content"
        assert result["metadata"]["pageCount"] == 2
        assert client.get.call_count == 2

    def test_poll_uses_relative_url(self):
        """Verify that polling converts absolute URL to relative."""
        client = _make_mock_client("https://test.cognitiveservices.azure.com")

        post_resp = _make_response(
            202,
            headers={
                "Operation-Location": ("https://test.cognitiveservices.azure.com/docint/ops/x")
            },
        )
        client.post.return_value = post_resp

        poll_done = _make_response(
            200,
            json_data={
                "status": "succeeded",
                "analyzeResult": {"content": "ok", "pages": [], "tables": [], "figures": []},
            },
        )
        client.get.return_value = poll_done

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            skill.execute(
                {"file_content": b"pdf", "_connection_type": "azure_doc_intelligence"},
                {},
                client,
            )

        # Should have called client.get with relative URL
        call_url = client.get.call_args[0][0]
        assert call_url == "/docint/ops/x"

    def test_poll_failure_status(self):
        """Azure returns failed status during polling."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            202,
            headers={"Operation-Location": "https://test.com/ops/x"},
        )
        client.get.return_value = _make_response(
            200,
            json_data={
                "status": "failed",
                "error": {"message": "Invalid document format"},
            },
        )

        skill = DocumentCrackerSkill()
        with pytest.raises(RuntimeError, match="Invalid document format"):
            skill.execute(
                {"file_content": b"bad-pdf", "_connection_type": "azure_doc_intelligence"},
                {},
                client,
            )

    def test_poll_timeout_returns_error(self):
        """Polling times out — returns friendly error instead of crash."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            202,
            headers={"Operation-Location": "https://test.com/ops/x"},
        )
        client.get.return_value = _make_response(200, json_data={"status": "running"})

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills._POLL_TIMEOUT", 0):
            with patch("app.services.builtin_skills.doc_skills.time.sleep"):
                result = skill.execute(
                    {
                        "file_content": b"big-pdf",
                        "_connection_type": "azure_doc_intelligence",
                    },
                    {},
                    client,
                )

        assert result["text"] == ""
        assert "超时" in result["error"]

    def test_tables_html_generation(self):
        """Verify table HTML is correctly generated from cells."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={
                "analyzeResult": {
                    "content": "table content",
                    "pages": [],
                    "tables": [
                        {
                            "rowCount": 2,
                            "columnCount": 2,
                            "cells": [
                                {"rowIndex": 0, "columnIndex": 0, "content": "A"},
                                {"rowIndex": 0, "columnIndex": 1, "content": "B"},
                                {"rowIndex": 1, "columnIndex": 0, "content": "1"},
                                {"rowIndex": 1, "columnIndex": 1, "content": "2"},
                            ],
                            "boundingRegions": [],
                        }
                    ],
                    "figures": [],
                }
            },
        )

        skill = DocumentCrackerSkill()
        result = skill.execute(
            {"file_content": b"pdf", "_connection_type": "azure_doc_intelligence"},
            {},
            client,
        )

        assert len(result["tables"]) == 1
        table = result["tables"][0]
        assert "<th>A</th>" in table["html"]
        assert "<th>B</th>" in table["html"]
        assert "<td>1</td>" in table["html"]
        assert "<td>2</td>" in table["html"]
        assert table["rowCount"] == 2
        assert table["columnCount"] == 2


# ---------------------------------------------------------------------------
# DocumentCrackerSkill — Content Understanding
# ---------------------------------------------------------------------------


class TestContentUnderstanding:
    def test_sync_200_response(self):
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={
                "result": {
                    "pages": [
                        {
                            "lines": [
                                {"content": "Line 1"},
                                {"content": "Line 2"},
                            ]
                        }
                    ]
                }
            },
        )

        skill = DocumentCrackerSkill()
        result = skill.execute(
            {"file_content": b"pdf", "_connection_type": "azure_content_understanding"},
            {},
            client,
        )

        assert result["text"] == "Line 1\nLine 2"
        assert result["metadata"]["pageCount"] == 1

    def test_async_202_poll_success(self):
        client = _make_mock_client()
        client.post.return_value = _make_response(
            202,
            headers={"Operation-Location": "https://test.com/cu/ops/x"},
        )
        client.get.return_value = _make_response(
            200,
            json_data={
                "status": "succeeded",
                "result": {"pages": [{"lines": [{"content": "Async result"}]}]},
            },
        )

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = skill.execute(
                {"file_content": b"pdf", "_connection_type": "azure_content_understanding"},
                {},
                client,
            )

        assert result["text"] == "Async result"


# ---------------------------------------------------------------------------
# DocumentCrackerSkill — connection type routing
# ---------------------------------------------------------------------------


class TestConnectionTypeRouting:
    def test_default_uses_content_understanding(self):
        """No _connection_type defaults to content understanding."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={"result": {"pages": [{"lines": [{"content": "text"}]}]}},
        )

        skill = DocumentCrackerSkill()
        skill.execute({"file_content": b"pdf"}, {}, client)

        # Content Understanding uses /contentunderstanding/ path
        call_url = client.post.call_args[0][0]
        assert "/contentunderstanding/" in call_url

    def test_doc_intelligence_routing(self):
        """_connection_type=azure_doc_intelligence routes correctly."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={
                "analyzeResult": {"content": "text", "pages": [], "tables": [], "figures": []}
            },
        )

        skill = DocumentCrackerSkill()
        skill.execute(
            {"file_content": b"pdf", "_connection_type": "azure_doc_intelligence"},
            {},
            client,
        )

        call_url = client.post.call_args[0][0]
        assert "/documentintelligence/" in call_url
        assert "prebuilt-layout" in call_url


# ---------------------------------------------------------------------------
# DocumentCrackerSkill — network error handling
# ---------------------------------------------------------------------------


class TestNetworkErrorHandling:
    def test_connection_reset_returns_friendly_error(self):
        """Connection reset after retries returns user-friendly error."""
        client = _make_mock_client()
        client.post.side_effect = ConnectionResetError("[Errno 54] Connection reset by peer")

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = skill.execute(
                {"file_content": b"pdf", "_connection_type": "azure_doc_intelligence"},
                {},
                client,
            )

        assert result["text"] == ""
        assert "连接异常" in result["error"]
        assert "重试" in result["error"]

    def test_connection_error_returns_friendly_error(self):
        """Generic ConnectionError after retries returns friendly error."""
        client = _make_mock_client()
        client.post.side_effect = ConnectionError("Network unreachable")

        skill = DocumentCrackerSkill()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = skill.execute(
                {"file_content": b"pdf", "_connection_type": "azure_doc_intelligence"},
                {},
                client,
            )

        assert result["text"] == ""
        assert "连接异常" in result["error"]


# ---------------------------------------------------------------------------
# Integration: BuiltinSkillRunner + DocumentCracker
# ---------------------------------------------------------------------------


class TestRunnerIntegration:
    def test_runner_with_mock_client(self):
        """Full runner integration: seed → execute → verify output format."""
        client = _make_mock_client()
        client.post.return_value = _make_response(
            200,
            json_data={
                "analyzeResult": {
                    "content": "# Title",
                    "pages": [{"pageNumber": 1, "width": 8.5, "height": 11, "unit": "inch"}],
                    "tables": [],
                    "figures": [],
                }
            },
        )

        runner = BuiltinSkillRunner()
        result = runner.execute(
            "DocumentCracker",
            {
                "values": [
                    {
                        "recordId": "1",
                        "data": {
                            "file_content": b"fake-pdf",
                            "_connection_type": "azure_doc_intelligence",
                        },
                    }
                ]
            },
            {},
            client,
        )

        assert len(result["values"]) == 1
        assert result["values"][0]["errors"] == []
        assert result["values"][0]["data"]["text"] == "# Title"
        assert "execution_time_ms" in result

    def test_runner_captures_network_error_per_record(self):
        """Runner captures connection errors as record-level errors."""
        client = _make_mock_client()
        client.post.side_effect = ConnectionResetError("reset")

        runner = BuiltinSkillRunner()
        with patch("app.services.builtin_skills.doc_skills.time.sleep"):
            result = runner.execute(
                "DocumentCracker",
                {
                    "values": [
                        {
                            "recordId": "1",
                            "data": {
                                "file_content": b"pdf",
                                "_connection_type": "azure_doc_intelligence",
                            },
                        }
                    ]
                },
                {},
                client,
            )

        rec = result["values"][0]
        # The friendly error should be in data (not in errors list)
        # because execute() catches transient errors and returns error dict
        assert rec["data"].get("error") or rec["errors"]


# ---------------------------------------------------------------------------
# ClientFactory timeout verification
# ---------------------------------------------------------------------------


class TestClientFactoryTimeout:
    def test_doc_intelligence_timeout_config(self):
        """Verify httpx.Client is created with proper timeout for doc intelligence."""
        import httpx

        from app.services.skill_context import ClientFactory

        client = ClientFactory.create(
            "azure_doc_intelligence",
            {"endpoint": "https://test.com", "api_key": "key123"},
        )

        assert isinstance(client, httpx.Client)
        assert client.timeout.read == 180
        assert client.timeout.write == 120
        assert client.timeout.connect == 10
        client.close()

    def test_content_understanding_timeout_config(self):
        """Verify httpx.Client timeout for content understanding."""
        import httpx

        from app.services.skill_context import ClientFactory

        client = ClientFactory.create(
            "azure_content_understanding",
            {"endpoint": "https://test.com", "api_key": "key123"},
        )

        assert isinstance(client, httpx.Client)
        assert client.timeout.read == 180
        assert client.timeout.write == 120
        assert client.timeout.connect == 10
        client.close()
