"""Manage local_upload temp directory, quota, and cleanup."""

from __future__ import annotations

import logging
import os
import shutil
import time
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


class UploadManager:
    """Handles file storage, quota enforcement, and cleanup for local uploads."""

    def __init__(self) -> None:
        settings = get_settings()
        self.temp_dir = Path(settings.upload_temp_dir)
        self.total_quota_bytes = settings.upload_total_quota_mb * 1024 * 1024
        self.max_file_bytes = settings.max_upload_size_mb * 1024 * 1024
        self.retention_days = settings.cleanup_retention_days

    def _ensure_dir(self, ds_id: str) -> Path:
        ds_dir = self.temp_dir / ds_id
        ds_dir.mkdir(parents=True, exist_ok=True)
        return ds_dir

    def calculate_used_bytes(self) -> int:
        """Calculate total bytes used in the temp directory."""
        if not self.temp_dir.exists():
            return 0
        total = 0
        for dirpath, _dirnames, filenames in os.walk(self.temp_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
        return total

    def save_file(self, ds_id: str, filename: str, content: bytes) -> Path:
        """Save an uploaded file. Raises ValueError on quota/size violation."""
        file_size = len(content)
        if file_size > self.max_file_bytes:
            max_mb = self.max_file_bytes // (1024 * 1024)
            raise ValueError(f"File size exceeds limit of {max_mb} MB")

        used = self.calculate_used_bytes()
        if used + file_size > self.total_quota_bytes:
            used_mb = round(used / (1024 * 1024), 1)
            total_mb = self.total_quota_bytes // (1024 * 1024)
            raise ValueError(
                f"Upload quota exceeded. Used: {used_mb} MB / {total_mb} MB. "
                "Please delete some files."
            )

        ds_dir = self._ensure_dir(ds_id)
        # Sanitise filename to avoid path traversal
        safe_name = Path(filename).name
        file_path = ds_dir / safe_name
        file_path.write_bytes(content)
        return file_path

    def delete_ds_files(self, ds_id: str) -> None:
        """Delete all files for a given data source."""
        ds_dir = self.temp_dir / ds_id
        if ds_dir.exists():
            shutil.rmtree(ds_dir)
            logger.info("Deleted upload directory for ds %s", ds_id)

    def get_ds_stats(self, ds_id: str) -> tuple[int, int]:
        """Return (file_count, total_size) for a data source directory."""
        ds_dir = self.temp_dir / ds_id
        if not ds_dir.exists():
            return 0, 0
        file_count = 0
        total_size = 0
        for f in ds_dir.iterdir():
            if f.is_file():
                file_count += 1
                total_size += f.stat().st_size
        return file_count, total_size

    def get_quota_info(self) -> dict:
        """Return quota information."""
        used = self.calculate_used_bytes()
        total_mb = self.total_quota_bytes // (1024 * 1024)
        used_mb = round(used / (1024 * 1024), 2)
        return {
            "total_mb": total_mb,
            "used_mb": used_mb,
            "available_mb": round(total_mb - used_mb, 2),
            "retention_days": self.retention_days,
            "max_file_size_mb": self.max_file_bytes // (1024 * 1024),
            "temp_dir": str(self.temp_dir),
        }

    def cleanup_expired(self) -> tuple[int, int]:
        """Delete files older than retention_days. Returns (files_deleted, bytes_freed)."""
        if not self.temp_dir.exists():
            return 0, 0

        cutoff = time.time() - (self.retention_days * 86400)
        files_deleted = 0
        bytes_freed = 0

        for ds_dir in self.temp_dir.iterdir():
            if not ds_dir.is_dir():
                continue
            for f in list(ds_dir.iterdir()):
                if not f.is_file():
                    continue
                try:
                    mtime = f.stat().st_mtime
                    if mtime < cutoff:
                        size = f.stat().st_size
                        f.unlink()
                        files_deleted += 1
                        bytes_freed += size
                except OSError as exc:
                    logger.warning("Failed to clean up %s: %s", f, exc)

            # Remove empty directories
            if ds_dir.exists() and not any(ds_dir.iterdir()):
                ds_dir.rmdir()

        if files_deleted:
            freed_mb = round(bytes_freed / (1024 * 1024), 2)
            logger.info(
                "Cleanup: deleted %d files, freed %s MB",
                files_deleted,
                freed_mb,
            )
        return files_deleted, bytes_freed
