"""Unit tests for the UploadManager."""

import time
from unittest.mock import patch

import pytest

from app.services.upload_manager import UploadManager


@pytest.fixture
def mgr(tmp_path):
    """Create an UploadManager backed by a temp directory."""
    with patch("app.services.upload_manager.get_settings") as mock:
        s = mock.return_value
        s.upload_temp_dir = str(tmp_path / "uploads")
        s.upload_total_quota_mb = 1  # 1 MB quota
        s.max_upload_size_mb = 1  # 1 MB per file
        s.cleanup_retention_days = 7
        yield UploadManager()


def test_save_and_stats(mgr):
    content = b"hello world"
    path = mgr.save_file("ds1", "test.txt", content)
    assert path.exists()
    assert path.read_bytes() == content

    fc, ts = mgr.get_ds_stats("ds1")
    assert fc == 1
    assert ts == len(content)


def test_save_path_traversal(mgr):
    """Filename with path traversal is sanitised to just the name part."""
    content = b"data"
    path = mgr.save_file("ds1", "../../../evil.txt", content)
    assert path.name == "evil.txt"
    assert "ds1" in str(path)


def test_file_size_limit(mgr):
    big = b"x" * (2 * 1024 * 1024)  # 2 MB > 1 MB limit
    with pytest.raises(ValueError, match="exceeds limit"):
        mgr.save_file("ds1", "big.bin", big)


def test_quota_exceeded(mgr):
    # Fill up quota (1 MB)
    data = b"x" * (512 * 1024)  # 512 KB each
    mgr.save_file("ds1", "a.bin", data)
    mgr.save_file("ds1", "b.bin", data)
    # Now should exceed
    with pytest.raises(ValueError, match="quota exceeded"):
        mgr.save_file("ds1", "c.bin", data)


def test_delete_ds_files(mgr):
    mgr.save_file("ds1", "a.txt", b"aaa")
    mgr.save_file("ds1", "b.txt", b"bbb")
    assert mgr.get_ds_stats("ds1")[0] == 2

    mgr.delete_ds_files("ds1")
    assert mgr.get_ds_stats("ds1") == (0, 0)


def test_delete_nonexistent(mgr):
    """Deleting a ds that has no files should not error."""
    mgr.delete_ds_files("nonexistent")


def test_get_quota_info(mgr):
    # Use a larger file so used_mb is non-zero after rounding
    mgr.save_file("ds1", "a.bin", b"x" * 10240)
    info = mgr.get_quota_info()
    assert info["total_mb"] == 1
    assert info["used_mb"] >= 0.01
    assert info["available_mb"] <= 1
    assert info["retention_days"] == 7
    assert info["max_file_size_mb"] == 1


def test_cleanup_expired(mgr):
    # Save a file and manually set mtime to 30 days ago
    path = mgr.save_file("ds1", "old.txt", b"old data")
    old_time = time.time() - (30 * 86400)
    import os

    os.utime(path, (old_time, old_time))

    # Also save a recent file
    mgr.save_file("ds2", "new.txt", b"new data")

    deleted, freed = mgr.cleanup_expired()
    assert deleted == 1
    assert freed == len(b"old data")

    # Old file gone, new file remains
    assert mgr.get_ds_stats("ds1") == (0, 0)
    assert mgr.get_ds_stats("ds2")[0] == 1


def test_calculate_used_bytes_empty(mgr):
    assert mgr.calculate_used_bytes() == 0
