"""Document processing built-in skill (DocumentCracker)."""

import logging
import time
from typing import Any
from urllib.parse import urlparse

from app.services.builtin_skills.base import BaseBuiltinSkill

logger = logging.getLogger(__name__)

# Max time to wait for async analyze operations (seconds)
_POLL_TIMEOUT = 120
_POLL_INTERVAL = 2

# Retry config for transient HTTP errors
_MAX_RETRIES = 3
_RETRY_BACKOFF = 2  # seconds, doubles each retry

# Transient exceptions that should be retried
_TRANSIENT_EXCEPTIONS = (
    ConnectionError,
    ConnectionResetError,
    TimeoutError,
)


def _is_transient_httpx_error(exc: Exception) -> bool:
    """Check if an httpx exception is transient and retryable."""
    import httpx

    if isinstance(exc, (httpx.ConnectError, httpx.ReadError, httpx.WriteError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code >= 500:
        return True
    return False


def _retry_request(func, *args, **kwargs):
    """Execute func with retry on transient errors."""
    last_exc = None
    for attempt in range(_MAX_RETRIES):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            if isinstance(exc, _TRANSIENT_EXCEPTIONS) or _is_transient_httpx_error(exc):
                last_exc = exc
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_RETRY_BACKOFF * (2**attempt))
                    continue
            raise
    raise last_exc  # type: ignore[misc]


def _to_relative_url(absolute_url: str, base_url: str) -> str:
    """Convert an absolute Operation-Location URL to a relative path.

    Azure returns full URLs like
    ``https://eastus.api.cognitive.microsoft.com/documentintelligence/...``
    but httpx Client has a base_url set, so we need the path + query only.
    """
    parsed = urlparse(absolute_url)
    relative = parsed.path
    if parsed.query:
        relative += "?" + parsed.query
    return relative


class DocumentCrackerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        """Crack documents using Azure Content Understanding or Doc Intelligence."""
        file_content: bytes | None = data.get("file_content")

        if not file_content:
            if "text" in data:
                return {"text": data["text"], "metadata": {}}
            return {"text": "", "metadata": {}, "error": "No file content provided"}

        connection_type = data.get("_connection_type", "azure_content_understanding")
        logger.info(
            "DocumentCracker: type=%s, file_size=%d bytes", connection_type, len(file_content)
        )

        if connection_type == "azure_doc_intelligence":
            return self._crack_with_doc_intelligence(client, file_content, config)
        return self._crack_with_content_understanding(client, file_content, config)

    def _poll_operation(self, client: Any, operation_url: str) -> dict:
        """Poll an async Azure operation until it completes or times out."""
        # Convert absolute URL to relative path for httpx base_url client
        base_url = str(client.base_url).rstrip("/")
        if operation_url.startswith("http"):
            poll_url = _to_relative_url(operation_url, base_url)
        else:
            poll_url = operation_url

        deadline = time.monotonic() + _POLL_TIMEOUT
        while time.monotonic() < deadline:
            resp = _retry_request(client.get, poll_url)
            resp.raise_for_status()
            body = resp.json()
            status = body.get("status", "")
            if status == "succeeded":
                return body
            if status == "failed":
                error_detail = body.get("error", {}).get("message", "Operation failed")
                raise RuntimeError(f"Analyze operation failed: {error_detail}")
            time.sleep(_POLL_INTERVAL)
        raise TimeoutError(f"Analyze operation did not complete within {_POLL_TIMEOUT}s")

    def _crack_with_content_understanding(
        self, client: Any, file_content: bytes, config: dict
    ) -> dict:
        """Use Azure Content Understanding to analyze document."""
        import base64

        b64 = base64.b64encode(file_content).decode("utf-8")
        logger.info("ContentUnderstanding: sending analyze request (%d bytes)", len(file_content))
        response = _retry_request(
            client.post,
            "/contentunderstanding/analyzers/prebuilt-read:analyze",
            params={"api-version": "2024-12-01-preview"},
            json={"base64Source": b64},
        )
        response.raise_for_status()
        logger.info("ContentUnderstanding: analyze response status=%d", response.status_code)

        # The analyze API is async: 202 with Operation-Location header
        if response.status_code == 202:
            operation_url = response.headers.get("Operation-Location", "")
            if not operation_url:
                raise RuntimeError("202 response but no Operation-Location header")
            logger.info("ContentUnderstanding: polling operation")
            result = self._poll_operation(client, operation_url)
            logger.info("ContentUnderstanding: polling completed successfully")
        else:
            result = response.json()

        text_parts = []
        for page in result.get("result", {}).get("pages", []):
            for line in page.get("lines", []):
                text_parts.append(line.get("content", ""))

        return {
            "text": "\n".join(text_parts),
            "metadata": {
                "pageCount": len(result.get("result", {}).get("pages", [])),
            },
        }

    def _crack_with_doc_intelligence(self, client: Any, file_content: bytes, config: dict) -> dict:
        """Use Azure Document Intelligence to analyze document.

        Sends raw bytes via application/octet-stream instead of base64 JSON
        to avoid large payload issues (base64 inflates size by ~33%).
        """
        logger.info("DocIntelligence: sending analyze request (%d bytes)", len(file_content))
        response = _retry_request(
            client.post,
            "/documentintelligence/documentModels/prebuilt-layout:analyze",
            params={
                "api-version": "2024-11-30",
                "outputContentFormat": "markdown",
            },
            content=file_content,
            headers={"Content-Type": "application/octet-stream"},
        )
        response.raise_for_status()
        logger.info("DocIntelligence: analyze response status=%d", response.status_code)

        # The analyze API is async: 202 with Operation-Location header
        if response.status_code == 202:
            operation_url = response.headers.get("Operation-Location", "")
            if not operation_url:
                raise RuntimeError("202 response but no Operation-Location header")
            logger.info("DocIntelligence: polling operation %s", operation_url[:100])
            result = self._poll_operation(client, operation_url)
            logger.info("DocIntelligence: polling completed successfully")
        else:
            result = response.json()

        analyze = result.get("analyzeResult", {})
        content = analyze.get("content", "")
        pages = analyze.get("pages", [])
        tables = analyze.get("tables", [])
        figures = analyze.get("figures", [])

        # Extract table HTML representations
        table_list = []
        for t in tables:
            cells = t.get("cells", [])
            row_count = t.get("rowCount", 0)
            col_count = t.get("columnCount", 0)
            grid: list[list[str]] = [["" for _ in range(col_count)] for _ in range(row_count)]
            for cell in cells:
                r = cell.get("rowIndex", 0)
                c = cell.get("columnIndex", 0)
                if r < row_count and c < col_count:
                    grid[r][c] = cell.get("content", "")
            html = "<table border='1'>"
            for ri, row in enumerate(grid):
                html += "<tr>"
                tag = "th" if ri == 0 else "td"
                for val in row:
                    html += f"<{tag}>{val}</{tag}>"
                html += "</tr>"
            html += "</table>"
            table_list.append(
                {
                    "html": html,
                    "rowCount": row_count,
                    "columnCount": col_count,
                    "boundingRegions": t.get("boundingRegions", []),
                }
            )

        # Extract figure info
        figure_list = []
        for f in figures:
            figure_list.append(
                {
                    "caption": (f.get("caption") or {}).get("content", ""),
                    "boundingRegions": f.get("boundingRegions", []),
                }
            )

        # Extract selection marks per page
        selection_marks: list[dict] = []
        for page in pages:
            for mark in page.get("selectionMarks", []):
                selection_marks.append(
                    {
                        "page": page.get("pageNumber", 0),
                        "state": mark.get("state", ""),
                        "confidence": mark.get("confidence", 0),
                        "polygon": mark.get("polygon", []),
                    }
                )

        # Build page metadata
        page_meta = []
        for page in pages:
            page_meta.append(
                {
                    "pageNumber": page.get("pageNumber", 0),
                    "width": page.get("width", 0),
                    "height": page.get("height", 0),
                    "unit": page.get("unit", ""),
                }
            )

        return {
            "markdown": content,
            "text": analyze.get("content", ""),
            "tables": table_list,
            "figures": figure_list,
            "selectionMarks": selection_marks,
            "pages": page_meta,
            "metadata": {"pageCount": len(pages)},
        }
