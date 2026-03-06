"""Document processing built-in skill (DocumentCracker)."""

from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


class DocumentCrackerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        """Crack documents using Azure Content Understanding or Doc Intelligence."""
        file_content: bytes | None = data.get("file_content")

        if not file_content:
            # If text is provided directly, pass through
            if "text" in data:
                return {"text": data["text"], "metadata": {}}
            return {"text": "", "metadata": {}, "error": "No file content provided"}

        # Detect connection type from client to choose backend
        connection_type = data.get("_connection_type", "azure_content_understanding")

        if connection_type == "azure_doc_intelligence":
            return self._crack_with_doc_intelligence(client, file_content, config)
        return self._crack_with_content_understanding(client, file_content, config)

    def _crack_with_content_understanding(
        self, client: Any, file_content: bytes, config: dict
    ) -> dict:
        """Use Azure Content Understanding to analyze document."""
        import base64

        b64 = base64.b64encode(file_content).decode("utf-8")
        response = client.post(
            "/contentunderstanding/analyzers/prebuilt-read:analyze",
            params={"api-version": "2024-12-01-preview"},
            json={"base64Source": b64},
        )
        response.raise_for_status()
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
        """Use Azure Document Intelligence to analyze document."""
        import base64

        b64 = base64.b64encode(file_content).decode("utf-8")
        response = client.post(
            "/documentintelligence/documentModels/prebuilt-read:analyze",
            params={"api-version": "2024-11-30"},
            json={"base64Source": b64},
        )
        response.raise_for_status()
        result = response.json()

        content = result.get("analyzeResult", {}).get("content", "")
        pages = result.get("analyzeResult", {}).get("pages", [])

        return {
            "text": content,
            "metadata": {"pageCount": len(pages)},
        }
