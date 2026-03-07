"""Schema mapping engine for Pipeline output → Target schema."""

from __future__ import annotations

import re

from app.schemas.target import MappingValidationResult, TargetSchemaField
from app.services.target_index_manager import _infer_pipeline_output_fields

# ---------------------------------------------------------------------------
# Pipeline output inference (reuses target_index_manager logic)
# ---------------------------------------------------------------------------


def infer_pipeline_outputs(pipeline: dict) -> list[dict]:
    """Return list of {path, type, from_skill, vector_hint} from Pipeline graph_data."""
    return _infer_pipeline_output_fields(pipeline)


# ---------------------------------------------------------------------------
# Auto-suggest mappings
# ---------------------------------------------------------------------------

# Type compatibility matrix: source_type → set of compatible target types
_TYPE_COMPAT: dict[str, set[str]] = {
    "string": {
        "string",
        "text",
        "varchar",
        "nvarchar",
        "Edm.String",
        "character varying",
        "TEXT",
    },
    "vector": {"vector", "Collection(Edm.Single)"},
    "array": {"array", "Collection(Edm.String)"},
    "int": {"int", "bigint", "integer", "Edm.Int32", "Edm.Int64"},
    "float": {"float", "double", "numeric", "Edm.Double", "double precision"},
    "boolean": {"boolean", "bool", "Edm.Boolean"},
    "datetime": {"datetime", "timestamp", "Edm.DateTimeOffset", "timestamp without time zone"},
    "json": {"json", "jsonb"},
}


def _to_snake_case(name: str) -> str:
    """Convert camelCase to snake_case."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def _to_camel_case(name: str) -> str:
    """Convert snake_case to camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def _last_segment(path: str) -> str:
    """Get the last segment of a path, ignoring wildcards."""
    parts = path.rstrip("/").split("/")
    for p in reversed(parts):
        if p != "*":
            return p
    return path


def _types_compatible(source_type: str, target_type: str) -> bool:
    """Check if source type is compatible with target type."""
    if source_type == target_type:
        return True
    compat = _TYPE_COMPAT.get(source_type, set())
    return target_type in compat


def suggest_mappings(
    pipeline_outputs: list[dict],
    target_schema: list[TargetSchemaField],
) -> list[dict]:
    """Suggest field mappings based on name matching and type compatibility."""
    suggestions: list[dict] = []
    used_targets: set[str] = set()

    for output in pipeline_outputs:
        src_name = _last_segment(output["path"])
        src_lower = src_name.lower()
        src_snake = _to_snake_case(src_name)
        src_camel = _to_camel_case(src_name)

        best_match = None
        match_quality = ""

        for tf in target_schema:
            if tf.name in used_targets:
                continue

            # Exact match
            if src_name == tf.name:
                best_match = tf
                match_quality = "exact"
                break

            # Case-insensitive match
            if src_lower == tf.name.lower():
                best_match = tf
                match_quality = "case_insensitive"
                continue

            # camelCase ↔ snake_case
            tf_snake = _to_snake_case(tf.name)
            tf_camel = _to_camel_case(tf.name)
            if src_snake == tf_snake or src_camel == tf_camel:
                if not best_match or match_quality != "case_insensitive":
                    best_match = tf
                    match_quality = "name_convention"

        if best_match:
            compatible = _types_compatible(output["type"], best_match.type)
            suggestions.append(
                {
                    "source": output["path"],
                    "target": best_match.name,
                    "target_type": best_match.type,
                    "match_quality": match_quality,
                    "type_compatible": compatible,
                }
            )
            used_targets.add(best_match.name)

    return suggestions


# ---------------------------------------------------------------------------
# Validate mapping
# ---------------------------------------------------------------------------


def validate_mapping(
    target_type: str,
    field_mappings: dict,
    pipeline_outputs: list[dict],
    target_schema: list[TargetSchemaField],
) -> MappingValidationResult:
    """Validate field_mappings against pipeline outputs and target schema."""
    errors: list[str] = []
    warnings: list[str] = []

    write_mode = field_mappings.get("write_mode", "upsert")
    key_field = field_mappings.get("key_field")
    mappings = field_mappings.get("mappings", [])

    output_paths = {o["path"] for o in pipeline_outputs}
    schema_names = {f.name for f in target_schema} if target_schema else set()

    # Check key_field for upsert/replace modes
    if write_mode in ("upsert", "replace") and not key_field:
        errors.append("key_field is required for upsert/replace write_mode")

    if key_field:
        src = key_field.get("source", "")
        if src and src not in output_paths:
            errors.append(f"key_field source '{src}' not found in pipeline outputs")

    # Check each mapping
    for m in mappings:
        source = m.get("source", "")
        target = m.get("target", "")
        t_type = m.get("target_type", "string")

        # Source must be reachable
        if source and source not in output_paths:
            errors.append(f"Mapping source '{source}' not found in pipeline outputs")

        # Target must exist in schema (if schema available)
        if target and schema_names and target not in schema_names:
            warnings.append(f"Mapping target '{target}' not found in target schema")

        # Vector fields must have dimensions
        if t_type == "vector":
            vc = m.get("vector_config")
            if not vc or not vc.get("dimensions"):
                errors.append(f"Vector field '{target}' must specify dimensions in vector_config")

        # Type compatibility check
        if target and target_schema:
            matched = next((f for f in target_schema if f.name == target), None)
            if matched:
                src_output = next((o for o in pipeline_outputs if o["path"] == source), None)
                if src_output and not _types_compatible(src_output["type"], matched.type):
                    warnings.append(
                        f"Type mismatch: {source} ({src_output['type']}) → "
                        f"{target} ({matched.type})"
                    )

    # Check required target fields are mapped
    if target_schema:
        mapped_targets = {m.get("target") for m in mappings}
        if key_field:
            mapped_targets.add(key_field.get("target"))
        for sf in target_schema:
            if sf.nullable is False and sf.name not in mapped_targets and not sf.key:
                warnings.append(f"Required target field '{sf.name}' is not mapped")

    return MappingValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Apply mapping (expand write_context, resolve source paths)
# ---------------------------------------------------------------------------


def apply_mapping(field_mappings: dict, enrichment_tree_data: dict) -> list[dict]:
    """Apply field_mappings to enrichment tree data, producing output records."""
    write_context = field_mappings.get("write_context", "/document")
    key_field = field_mappings.get("key_field")
    mappings = field_mappings.get("mappings", [])

    # Resolve write_context to get the list of context objects
    contexts = _resolve_context(write_context, enrichment_tree_data)

    records: list[dict] = []
    for ctx in contexts:
        record: dict = {}

        # Apply key field
        if key_field:
            source = key_field.get("source", "")
            target = key_field.get("target", "id")
            record[target] = _resolve_path(source, enrichment_tree_data, ctx)

        # Apply each mapping
        for m in mappings:
            source = m.get("source", "")
            target = m.get("target", "")
            value = _resolve_path(source, enrichment_tree_data, ctx)
            if value is not None:
                record[target] = value

        if record:
            records.append(record)

    return records


def _resolve_context(context_path: str, data: dict) -> list[dict]:
    """Expand a write_context path into a list of context dicts."""
    if not context_path or context_path == "/document":
        return [data]

    parts = context_path.strip("/").split("/")
    current: list = [data]

    for part in parts:
        if part == "*":
            # Expand: unwrap any lists in current into individual items
            expanded = []
            for item in current:
                if isinstance(item, list):
                    expanded.extend(item)
                else:
                    expanded.append(item)
            current = expanded
        else:
            # Navigate: look up key in each current item, keep lists intact
            next_level = []
            for item in current:
                if isinstance(item, dict) and part in item:
                    next_level.append(item[part])
            current = next_level

    return current


def _resolve_path(path: str, root_data: dict, context: dict) -> object:
    """Resolve a source path to a value, considering the current context."""
    if not path:
        return None

    parts = path.strip("/").split("/")
    # Try context-relative first (for paths within write_context)
    result = _navigate(context, parts[-1:])
    if result is not None:
        return result

    # Fall back to absolute path from root
    return _navigate(root_data, parts)


def _navigate(data: object, parts: list[str]) -> object:
    """Navigate a nested dict/list by path parts."""
    current = data
    for part in parts:
        if part == "*":
            continue
        if isinstance(current, dict) and part in current:
            current = current[part]
        elif isinstance(current, list):
            try:
                idx = int(part)
                current = current[idx]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return current
