"""Azure AI Vision built-in skills (OCR and Image Analysis)."""

import base64
from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


def _get_image_data(data: dict) -> tuple[bytes | None, str | None]:
    """Extract image bytes from data (base64 or file_content)."""
    if "file_content" in data:
        return data["file_content"], data.get("file_name")
    if "image_base64" in data:
        return base64.b64decode(data["image_base64"]), data.get("file_name")
    if "url" in data:
        return None, data["url"]
    return None, None


class OCRSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        image_bytes, image_url = _get_image_data(data)

        # If text-only input, return as-is (OCR not needed)
        if not image_bytes and not image_url and text:
            return {"text": text}

        params = {
            "api-version": "2024-02-01",
            "features": "read",
        }

        if image_bytes:
            response = client.post(
                "/computervision/imageanalysis:analyze",
                params=params,
                content=image_bytes,
                headers={"Content-Type": "application/octet-stream"},
            )
        elif image_url:
            response = client.post(
                "/computervision/imageanalysis:analyze",
                params=params,
                json={"url": image_url},
            )
        else:
            return {"text": "", "pages": []}

        response.raise_for_status()
        result = response.json()

        read_result = result.get("readResult", {})
        blocks = read_result.get("blocks", [])
        full_text = ""
        pages = []
        for block in blocks:
            for line in block.get("lines", []):
                full_text += line.get("text", "") + "\n"
            pages.append(
                {
                    "lines": [ln.get("text", "") for ln in block.get("lines", [])],
                }
            )

        return {"text": full_text.strip(), "pages": pages}


class ImageAnalyzerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        features = config.get("features", ["description", "tags", "objects"])
        max_tags = config.get("max_tags", 20)
        image_bytes, image_url = _get_image_data(data)

        feature_str = ",".join(f.replace("description", "caption") for f in features)
        params = {
            "api-version": "2024-02-01",
            "features": feature_str,
        }

        if image_bytes:
            response = client.post(
                "/computervision/imageanalysis:analyze",
                params=params,
                content=image_bytes,
                headers={"Content-Type": "application/octet-stream"},
            )
        elif image_url:
            response = client.post(
                "/computervision/imageanalysis:analyze",
                params=params,
                json={"url": image_url},
            )
        else:
            return {"description": "", "tags": [], "objects": []}

        response.raise_for_status()
        result = response.json()

        output: dict = {}
        if "captionResult" in result:
            output["description"] = result["captionResult"].get("text", "")
            output["descriptionConfidence"] = result["captionResult"].get("confidence", 0)
        if "tagsResult" in result:
            tags = result["tagsResult"].get("values", [])
            output["tags"] = [
                {"name": t["name"], "confidence": t["confidence"]} for t in tags[:max_tags]
            ]
        if "objectsResult" in result:
            output["objects"] = [
                {
                    "name": o["tags"][0]["name"] if o.get("tags") else "unknown",
                    "confidence": (o["tags"][0]["confidence"] if o.get("tags") else 0),
                    "boundingBox": o.get("boundingBox", {}),
                }
                for o in result["objectsResult"].get("values", [])
            ]

        return output
