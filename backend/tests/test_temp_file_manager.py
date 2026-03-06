"""Tests for temporary file management."""

from datetime import UTC, datetime, timedelta

from app.services.temp_file_manager import (
    _file_registry,
    cleanup_expired_files,
    resolve_temp_file,
    save_temp_file,
)


def test_save_and_resolve():
    info = save_temp_file("test.txt", b"hello world", "text/plain")
    assert info["filename"] == "test.txt"
    assert info["size"] == 11
    assert "file_id" in info

    resolved = resolve_temp_file(info["file_id"])
    assert resolved is not None
    assert resolved["content"] == b"hello world"
    assert resolved["filename"] == "test.txt"

    # Cleanup
    import os

    os.remove(info["path"])
    del _file_registry[info["file_id"]]


def test_resolve_nonexistent():
    assert resolve_temp_file("nonexistent-id") is None


def test_cleanup_expired():
    info = save_temp_file("expired.txt", b"old data", "text/plain")
    file_id = info["file_id"]

    # Manually set expiry to past
    _file_registry[file_id]["expires_at"] = (datetime.now(UTC) - timedelta(hours=2)).isoformat()

    cleanup_expired_files()

    assert file_id not in _file_registry
    assert resolve_temp_file(file_id) is None
