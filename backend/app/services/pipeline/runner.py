"""PipelineRunner — executes pipeline nodes sequentially via EnrichmentTree."""

from __future__ import annotations

import logging
import time
import traceback
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.connection import Connection
from app.models.skill import Skill
from app.services.builtin_skills.runner import SKILL_REGISTRY
from app.services.pipeline.enrichment_tree import EnrichmentTree
from app.services.skill_context import ClientFactory

logger = logging.getLogger(__name__)

# Truncate snapshot values larger than this many characters.
_SNAPSHOT_MAX_CHARS = 2000


class PipelineRunner:
    """Executes a pipeline by walking nodes in position order."""

    async def execute(
        self,
        pipeline: dict,
        file_content: bytes,
        file_name: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Run the full pipeline and return a debug result dict.

        Returns::

            {
                "status": "success" | "partial" | "error",
                "total_execution_time_ms": int,
                "enrichment_tree": dict,
                "node_results": list[dict],
            }
        """
        start = time.time()
        tree = EnrichmentTree()
        tree.set("/document/file_content", file_content)
        tree.set("/document/file_name", file_name)

        nodes: list[dict] = pipeline.get("graph_data", {}).get("nodes", [])
        nodes = sorted(nodes, key=lambda n: n.get("position", 0))

        node_results: list[dict] = []
        final_status = "success"

        for node in nodes:
            result = await self._execute_node(node, tree, db)
            node_results.append(result)
            if result["status"] == "error":
                final_status = "partial"
                break

        elapsed_ms = int((time.time() - start) * 1000)
        return {
            "status": final_status,
            "total_execution_time_ms": elapsed_ms,
            "enrichment_tree": tree.to_dict(exclude_binary=True),
            "node_results": node_results,
        }

    # ------------------------------------------------------------------
    # Per-node execution
    # ------------------------------------------------------------------

    async def _execute_node(
        self,
        node: dict,
        tree: EnrichmentTree,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Execute a single pipeline node (possibly with fan-out)."""
        node_id = node.get("id", "unknown")
        skill_name = node.get("skill_name", "")
        label = node.get("label", skill_name)
        context_path = node.get("context", "/document")
        inputs_def: list[dict] = node.get("inputs", [])
        outputs_def: list[dict] = node.get("outputs", [])
        config_overrides: dict = node.get("config_overrides", {})

        node_start = time.time()
        input_snapshots: list[dict] = []
        output_snapshots: list[dict] = []
        errors: list[dict] = []
        warnings: list[str] = []

        try:
            # Resolve skill from DB
            skill = await self._get_skill(skill_name, db)
            if not skill:
                raise ValueError(f"Skill '{skill_name}' not found in database")

            # Resolve connection client
            client = await self._resolve_client(node, skill, db)

            # Merge config: skill defaults < skill config_values < node overrides
            config = dict(skill.config_values or {})
            config.update(config_overrides)

            # Expand context for fan-out
            instance_paths = tree.expand_context(context_path)
            if not instance_paths:
                warnings.append(f"Context '{context_path}' expanded to 0 instances")
                instance_paths = [context_path.rstrip("/*")]

            # Inject _connection_type if we have a connection
            conn_type = None
            if client and skill.required_resource_types:
                conn_type = skill.required_resource_types[0]

            try:
                for instance_path in instance_paths:
                    # Resolve input values from tree
                    data: dict[str, Any] = {}
                    for inp in inputs_def:
                        source = tree.resolve_source(inp["source"], context_path, instance_path)
                        try:
                            data[inp["name"]] = tree.get(source)
                        except KeyError:
                            warnings.append(f"Input '{inp['name']}' source '{source}' not found")

                    if conn_type:
                        data["_connection_type"] = conn_type

                    input_snapshots.append(_truncate_snapshot(data))

                    # Execute skill
                    impl = SKILL_REGISTRY[skill_name]()
                    output = impl.execute(data, config, client)
                    if not isinstance(output, dict):
                        output = {"result": output}

                    output_snapshots.append(_truncate_snapshot(output))

                    # Write outputs to tree
                    for out in outputs_def:
                        out_name = out["name"]
                        target_name = out.get("targetName", out_name)
                        if out_name in output:
                            target_path = f"{instance_path}/{target_name}"
                            tree.set(target_path, output[out_name])
            finally:
                # Close httpx.Client to release TCP connections
                if client is not None and hasattr(client, "close"):
                    try:
                        client.close()
                    except Exception:
                        pass

        except Exception as exc:
            errors.append(
                {
                    "message": str(exc),
                    "traceback": traceback.format_exc(),
                }
            )

        elapsed_ms = int((time.time() - node_start) * 1000)
        status = "error" if errors else "success"
        return {
            "node_id": node_id,
            "skill_name": skill_name,
            "label": label,
            "status": status,
            "execution_time_ms": elapsed_ms,
            "records_processed": len(input_snapshots),
            "input_snapshots": input_snapshots,
            "output_snapshots": output_snapshots,
            "errors": errors,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_skill(self, skill_name: str, db: AsyncSession) -> Skill | None:
        result = await db.execute(select(Skill).where(Skill.name == skill_name))
        return result.scalar_one_or_none()

    async def _resolve_client(
        self,
        node: dict,
        skill: Skill,
        db: AsyncSession,
    ) -> Any | None:
        """Resolve connection with 3-level priority:

        1. node-level ``bound_connection_id``
        2. skill-level ``bound_connection_id``
        3. default connection for the required resource type
        """
        if not skill.required_resource_types:
            return None

        target_type = skill.required_resource_types[0]

        # Level 1: node-level
        conn_id = node.get("bound_connection_id")

        # Level 2: skill-level
        if not conn_id:
            conn_id = skill.bound_connection_id

        # Level 3: default for type
        if not conn_id:
            result = await db.execute(
                select(Connection).where(
                    Connection.connection_type == target_type,
                    Connection.is_default.is_(True),
                )
            )
            default_conn = result.scalar_one_or_none()
            if default_conn:
                conn_id = default_conn.id

        if not conn_id:
            raise ValueError(
                f"No connection available for type '{target_type}' (skill: {skill.name})"
            )

        result = await db.execute(select(Connection).where(Connection.id == conn_id))
        conn = result.scalar_one_or_none()
        if not conn:
            raise ValueError(f"Connection '{conn_id}' not found")

        from app.schemas.connection import SECRET_FIELDS
        from app.utils.encryption import decrypt_config

        secret_fields = SECRET_FIELDS.get(conn.connection_type, [])
        decrypted = decrypt_config(conn.config, secret_fields)
        return ClientFactory.create(conn.connection_type, decrypted)


def _truncate_snapshot(data: dict) -> dict:
    """Create a JSON-serializable snapshot with large values truncated."""
    result = {}
    for key, val in data.items():
        if isinstance(val, bytes):
            result[key] = f"(binary, {len(val)} bytes)"
        elif isinstance(val, str) and len(val) > _SNAPSHOT_MAX_CHARS:
            result[key] = val[:_SNAPSHOT_MAX_CHARS] + f"... ({len(val)} chars)"
        elif isinstance(val, list) and len(val) > 20:
            result[key] = f"(array, {len(val)} items)"
        else:
            result[key] = val
    return result
