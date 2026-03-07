"""Path-addressable shared data store used during pipeline execution.

Every skill reads from and writes to the tree using slash-delimited paths
(e.g. ``/document/chunks/0/text``).  The tree supports wildcard expansion
for fan-out execution and binary-safe serialization for debug responses.
"""

from __future__ import annotations

import copy
from typing import Any

_EMBEDDING_TRUNCATE_THRESHOLD = 1536


class EnrichmentTree:
    """In-memory hierarchical data store for a single pipeline run."""

    def __init__(self) -> None:
        self._data: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Core read / write
    # ------------------------------------------------------------------

    def get(self, path: str) -> Any:
        """Return the value at *path*.

        Raises ``KeyError`` if the path does not exist.
        """
        segments = _parse_path(path)
        node: Any = self._data
        for seg in segments:
            try:
                node = _child(node, seg)
            except (KeyError, IndexError, TypeError) as exc:
                raise KeyError(path) from exc
        return node

    def set(self, path: str, value: Any) -> None:  # noqa: A003
        """Set *value* at *path*, creating intermediate dicts / lists."""
        segments = _parse_path(path)
        if not segments:
            raise ValueError("Cannot set the root path")
        node: Any = self._data
        for i, seg in enumerate(segments[:-1]):
            next_seg = segments[i + 1]
            node = _ensure_child(node, seg, next_seg)
        _set_child(node, segments[-1], value)

    def has(self, path: str) -> bool:
        """Return ``True`` if *path* exists in the tree."""
        try:
            self.get(path)
            return True
        except KeyError:
            return False

    # ------------------------------------------------------------------
    # Context expansion & source resolution
    # ------------------------------------------------------------------

    def expand_context(self, context_path: str) -> list[str]:
        """Expand a context path into concrete instance paths.

        If *context_path* ends with ``/*``, iterate over the array at the
        parent path and return one path per element.  Otherwise return
        ``[context_path]`` unchanged.
        """
        if not context_path.endswith("/*"):
            return [context_path]

        parent_path = context_path[:-2]  # strip "/*"
        try:
            arr = self.get(parent_path)
        except KeyError:
            return []
        if not isinstance(arr, list):
            return [parent_path]
        return [f"{parent_path}/{i}" for i in range(len(arr))]

    @staticmethod
    def resolve_source(
        source: str,
        context_path: str,
        instance_path: str,
    ) -> str:
        """Replace ``*`` in *source* with the instance index.

        If *source* contains ``*`` **and** *context_path* contains ``*``,
        replace the first ``*`` in *source* with the concrete index from
        *instance_path*.  Otherwise return *source* as-is.
        """
        if "*" not in source or "*" not in context_path:
            return source

        # Extract the index from instance_path.
        # context_path: "/document/chunks/*"
        # instance_path: "/document/chunks/2"
        prefix = context_path.split("/*")[0]
        suffix = instance_path[len(prefix) + 1 :]  # "2" or "2/sub"
        index = suffix.split("/")[0]
        return source.replace("*", index, 1)

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_dict(self, *, exclude_binary: bool = False) -> dict[str, Any]:
        """Return a deep copy of the tree data.

        When *exclude_binary* is ``True``:
        - ``bytes`` values become ``"(binary, N bytes)"``
        - lists longer than 1536 items (e.g. embedding vectors) are
          truncated to the first 5 elements plus ``"...(N dims)"``.
        """
        if not exclude_binary:
            return copy.deepcopy(self._data)
        return _sanitize(self._data)


# ======================================================================
# Internal helpers
# ======================================================================


def _parse_path(path: str) -> list[str | int]:
    """Split ``"/a/0/b"`` into ``["a", 0, "b"]``."""
    parts = [p for p in path.split("/") if p]
    result: list[str | int] = []
    for p in parts:
        if p.isdigit():
            result.append(int(p))
        else:
            result.append(p)
    return result


def _child(node: Any, key: str | int) -> Any:
    if isinstance(key, int):
        return node[key]
    return node[key]


def _ensure_child(node: Any, key: str | int, next_key: str | int) -> Any:
    """Descend into *node[key]*, creating an empty dict or list if needed."""
    need_list = isinstance(next_key, int) or next_key == "*"

    if isinstance(node, dict):
        if key not in node:
            node[key] = [] if need_list else {}
        return node[key]

    if isinstance(node, list):
        idx = int(key)
        while len(node) <= idx:
            node.append([] if need_list else {})
        return node[idx]

    raise TypeError(f"Cannot descend into {type(node)} with key {key!r}")


def _set_child(node: Any, key: str | int, value: Any) -> None:
    if isinstance(node, dict):
        node[str(key) if isinstance(key, int) else key] = value
    elif isinstance(node, list):
        idx = int(key)
        while len(node) <= idx:
            node.append(None)
        node[idx] = value
    else:
        raise TypeError(f"Cannot set child on {type(node)}")


def _sanitize(obj: Any) -> Any:
    """Recursively replace binary / large-array values."""
    if isinstance(obj, bytes):
        return f"(binary, {len(obj)} bytes)"
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        if len(obj) > _EMBEDDING_TRUNCATE_THRESHOLD and all(
            isinstance(x, (int, float)) for x in obj[:10]
        ):
            return obj[:5] + [f"...({len(obj)} dims)"]
        return [_sanitize(x) for x in obj]
    return obj
