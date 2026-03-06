"""Local utility skills (no external resource needed)."""

import re
from typing import Any

from app.services.builtin_skills.base import BaseBuiltinSkill


class TextSplitterSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        text = data.get("text", "")
        chunk_size = config.get("chunk_size", 1000)
        chunk_overlap = config.get("chunk_overlap", 200)
        method = config.get("split_method", "recursive")
        separators = config.get("separators", ["\n\n", "\n", ". ", " "])

        if method == "fixed_size":
            chunks = self._split_fixed(text, chunk_size, chunk_overlap)
        elif method == "sentence":
            chunks = self._split_by_separator(
                text, [". ", "! ", "? ", "\n"], chunk_size, chunk_overlap
            )
        elif method == "paragraph":
            chunks = self._split_by_separator(text, ["\n\n", "\n"], chunk_size, chunk_overlap)
        else:  # recursive
            chunks = self._split_recursive(text, separators, chunk_size, chunk_overlap)

        return {
            "chunks": [{"index": i, "text": c, "length": len(c)} for i, c in enumerate(chunks)],
            "totalChunks": len(chunks),
        }

    def _split_fixed(self, text: str, size: int, overlap: int) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + size
            chunks.append(text[start:end])
            start = end - overlap if overlap < size else end
        return [c for c in chunks if c.strip()]

    def _split_by_separator(
        self, text: str, seps: list[str], max_size: int, overlap: int
    ) -> list[str]:
        pattern = "|".join(re.escape(s) for s in seps)
        segments = re.split(f"({pattern})", text)
        chunks: list[str] = []
        current = ""
        for seg in segments:
            if len(current) + len(seg) > max_size and current.strip():
                chunks.append(current.strip())
                # Keep overlap from end of current
                current = current[-overlap:] if overlap else ""
            current += seg
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _split_recursive(
        self, text: str, seps: list[str], max_size: int, overlap: int
    ) -> list[str]:
        if len(text) <= max_size:
            return [text] if text.strip() else []

        for sep in seps:
            if sep in text:
                parts = text.split(sep)
                chunks: list[str] = []
                current = ""
                for part in parts:
                    candidate = current + sep + part if current else part
                    if len(candidate) > max_size and current.strip():
                        chunks.append(current.strip())
                        current = part
                    else:
                        current = candidate
                if current.strip():
                    chunks.append(current.strip())
                return chunks

        # Fallback to fixed size
        return self._split_fixed(text, max_size, overlap)


class TextMergerSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        texts = data.get("texts", [])
        separator = config.get("separator", "\n\n")
        max_length = config.get("max_length", 0)

        if isinstance(texts, str):
            texts = [texts]

        merged = separator.join(str(t) for t in texts)

        if max_length > 0 and len(merged) > max_length:
            merged = merged[:max_length]

        return {"text": merged, "sourceCount": len(texts)}


class ShaperSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        mappings = config.get("field_mappings", [])
        output: dict = {}

        for mapping in mappings:
            source = mapping.get("source", "")
            target = mapping.get("target", "")
            default = mapping.get("default_value")

            if not source or not target:
                continue

            # Support nested access with dot notation
            value = data
            for key in source.split("."):
                if isinstance(value, dict):
                    value = value.get(key, default)
                else:
                    value = default
                    break

            output[target] = value

        return output


class ConditionalSkill(BaseBuiltinSkill):
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        field = config.get("condition_field", "")
        operator = config.get("operator", "equals")
        condition_value = config.get("condition_value")

        # Get field value (support dot notation)
        value = data
        for key in field.split("."):
            if isinstance(value, dict):
                value = value.get(key)
            else:
                value = None
                break

        result = self._evaluate(value, operator, condition_value)

        return {
            "matches": result,
            "field": field,
            "fieldValue": value,
            "operator": operator,
            "conditionValue": condition_value,
        }

    def _evaluate(self, value: Any, operator: str, target: Any) -> bool:
        match operator:
            case "equals":
                return value == target
            case "not_equals":
                return value != target
            case "contains":
                return str(target) in str(value) if value is not None else False
            case "greater_than":
                try:
                    return float(value) > float(target)
                except (TypeError, ValueError):
                    return False
            case "less_than":
                try:
                    return float(value) < float(target)
                except (TypeError, ValueError):
                    return False
            case "regex_match":
                try:
                    return bool(re.search(str(target), str(value)))
                except re.error:
                    return False
            case _:
                return False
