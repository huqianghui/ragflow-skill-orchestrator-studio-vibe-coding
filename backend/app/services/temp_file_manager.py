"""Temporary file management for skill testing."""

import logging
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

TEMP_DIR = Path("data/temp_files")
EXPIRY_HOURS = 1

# In-memory registry: file_id -> {path, filename, content_type, size, expires_at}
_file_registry: dict[str, dict] = {}


def _ensure_dir():
    TEMP_DIR.mkdir(parents=True, exist_ok=True)


def save_temp_file(filename: str, content: bytes, content_type: str) -> dict:
    """Save an uploaded file and return its metadata."""
    _ensure_dir()
    file_id = str(uuid.uuid4())
    ext = Path(filename).suffix
    file_path = TEMP_DIR / f"{file_id}{ext}"
    file_path.write_bytes(content)

    expires_at = datetime.now(UTC) + timedelta(hours=EXPIRY_HOURS)
    info = {
        "file_id": file_id,
        "path": str(file_path),
        "filename": filename,
        "content_type": content_type,
        "size": len(content),
        "expires_at": expires_at.isoformat(),
    }
    _file_registry[file_id] = info
    return info


def resolve_temp_file(file_id: str) -> dict | None:
    """Resolve a file_id to its content and metadata."""
    info = _file_registry.get(file_id)
    if not info:
        return None

    path = Path(info["path"])
    if not path.exists():
        return None

    return {
        "content": path.read_bytes(),
        "filename": info["filename"],
        "content_type": info["content_type"],
    }


def cleanup_expired_files():
    """Remove expired temporary files."""
    now = datetime.now(UTC)
    expired = []
    for file_id, info in _file_registry.items():
        expires_at = datetime.fromisoformat(info["expires_at"])
        if now > expires_at:
            expired.append(file_id)
            path = Path(info["path"])
            if path.exists():
                try:
                    os.remove(path)
                except OSError:
                    logger.warning("Failed to remove temp file: %s", path)

    for file_id in expired:
        del _file_registry[file_id]

    if expired:
        logger.info("Cleaned up %d expired temp files", len(expired))
