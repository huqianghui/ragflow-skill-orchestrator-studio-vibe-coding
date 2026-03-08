"""ContextBuilder — assembles structured prompt prefix from context data."""

import json


class ContextBuilder:
    """Assembles auto-context and manual attachments into a prompt prefix."""

    def build(self, context: dict | None, user_prompt: str) -> str:
        if not context or context.get("type") == "free":
            return user_prompt

        parts: list[str] = []
        ctx_type = context.get("type", "free")

        if ctx_type == "skill" and context.get("skill"):
            parts.append(self._build_skill_section(context["skill"]))
        elif ctx_type == "pipeline" and context.get("pipeline"):
            parts.append(self._build_pipeline_section(context["pipeline"]))

        if context.get("error_result"):
            parts.append(self._build_error_section(context["error_result"]))

        if context.get("attachments"):
            parts.append(self._build_attachments_section(context["attachments"]))

        parts.append(f"## User Request\n\n{user_prompt}")
        return "\n\n".join(parts)

    def _build_skill_section(self, skill: dict) -> str:
        lines = [
            "## Current Skill Context",
            f"- Name: {skill.get('name', 'unknown')}",
            f"- Type: {skill.get('skill_type', 'unknown')}",
        ]
        if skill.get("description"):
            lines.append(f"- Description: {skill['description']}")
        if skill.get("source_code"):
            lines.append(f"\n### Source Code\n```python\n{skill['source_code']}\n```")
        if skill.get("test_input"):
            lines.append(
                "\n### Test Input\n```json\n"
                + json.dumps(skill["test_input"], indent=2, ensure_ascii=False)
                + "\n```"
            )
        return "\n".join(lines)

    def _build_pipeline_section(self, pipeline: dict) -> str:
        lines = [
            "## Current Pipeline Context",
            f"- Name: {pipeline.get('name', 'unknown')}",
            f"- Status: {pipeline.get('status', 'draft')}",
        ]
        nodes = pipeline.get("graph_data", {}).get("nodes", [])
        if nodes:
            lines.append(f"\n### Pipeline Nodes ({len(nodes)} nodes)")
            for n in sorted(nodes, key=lambda x: x.get("position", 0)):
                label = n.get("label", n.get("skill_name", "?"))
                lines.append(f"  {n.get('position', '?')}. {label}")
        return "\n".join(lines)

    def _build_error_section(self, error: dict) -> str:
        lines = ["## Error Context"]
        if isinstance(error, dict):
            for err in error.get("errors", [error]):
                lines.append(f"- Message: {err.get('message', 'unknown')}")
                if err.get("traceback"):
                    lines.append(f"```\n{err['traceback']}\n```")
        return "\n".join(lines)

    def _build_attachments_section(self, attachments: list[dict]) -> str:
        lines = ["## Additional Context"]
        for att in attachments:
            att_type = att.get("type", "text")
            lines.append(f"\n### Attachment ({att_type})")
            lines.append(att.get("content", ""))
        return "\n".join(lines)


context_builder = ContextBuilder()
