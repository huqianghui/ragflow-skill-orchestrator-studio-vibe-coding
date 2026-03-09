"""File enumeration and reading for each data source type."""

from __future__ import annotations

import asyncio
import logging
import mimetypes
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)

_READ_TIMEOUT_S = 60


class FileInfo(BaseModel):
    """Metadata about a single file in a data source."""

    name: str
    path: str
    size: int
    mime_type: str | None = None
    last_modified: datetime | None = None
    etag: str | None = None


# ---------------------------------------------------------------------------
# Local upload
# ---------------------------------------------------------------------------


async def _list_local_upload(config: dict, ds_id: str, **_kwargs: object) -> list[FileInfo]:
    settings = get_settings()
    ds_dir = Path(settings.upload_temp_dir) / ds_id
    if not ds_dir.exists():
        return []

    files: list[FileInfo] = []
    for f in sorted(ds_dir.iterdir()):
        if not f.is_file():
            continue
        stat = f.stat()
        mime, _ = mimetypes.guess_type(f.name)
        files.append(
            FileInfo(
                name=f.name,
                path=str(f.relative_to(ds_dir)),
                size=stat.st_size,
                mime_type=mime,
                last_modified=datetime.fromtimestamp(stat.st_mtime, tz=UTC),
                etag=f"{stat.st_mtime}:{stat.st_size}",
            )
        )
    return files


async def _read_local_upload(config: dict, ds_id: str, file_path: str, **_kwargs: object) -> bytes:
    settings = get_settings()
    ds_dir = Path(settings.upload_temp_dir) / ds_id
    target = ds_dir / file_path

    # Prevent path traversal
    resolved = target.resolve()
    if not str(resolved).startswith(str(ds_dir.resolve())):
        raise ValueError("Invalid file path: path traversal detected")

    if not target.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    return target.read_bytes()


# ---------------------------------------------------------------------------
# Azure Blob Storage
# ---------------------------------------------------------------------------


async def _list_azure_blob(
    config: dict, ds_id: str, max_results: int = 1000, **_kwargs: object
) -> list[FileInfo]:
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(config["connection_string"])
    container_name = config.get("container_name", "")
    container = client.get_container_client(container_name)
    prefix = config.get("path_prefix", "") or None

    files: list[FileInfo] = []
    count = 0
    for blob in container.list_blobs(name_starts_with=prefix):
        if count >= max_results:
            break
        mime, _ = mimetypes.guess_type(blob.name)
        files.append(
            FileInfo(
                name=blob.name.rsplit("/", 1)[-1] if "/" in blob.name else blob.name,
                path=blob.name,
                size=blob.size or 0,
                mime_type=mime or blob.content_settings.content_type,
                last_modified=blob.last_modified,
                etag=blob.etag,
            )
        )
        count += 1
    return files


async def _read_azure_blob(config: dict, ds_id: str, file_path: str, **_kwargs: object) -> bytes:
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(config["connection_string"])
    container_name = config.get("container_name", "")
    container = client.get_container_client(container_name)
    blob_client = container.get_blob_client(file_path)
    downloader = blob_client.download_blob()
    return downloader.readall()


# ---------------------------------------------------------------------------
# Dispatchers
# ---------------------------------------------------------------------------

_LISTERS: dict[str, object] = {
    "local_upload": _list_local_upload,
    "azure_blob": _list_azure_blob,
}

_READERS: dict[str, object] = {
    "local_upload": _read_local_upload,
    "azure_blob": _read_azure_blob,
}


async def list_files(
    source_type: str,
    config: dict,
    ds_id: str,
    max_results: int = 1000,
) -> list[FileInfo]:
    """List files in a data source. Returns a list of FileInfo objects."""
    lister = _LISTERS.get(source_type)
    if not lister:
        from app.utils.exceptions import ValidationException

        raise ValidationException(f"File listing is not supported for source type: {source_type}")
    try:
        result = await asyncio.wait_for(
            lister(config, ds_id, max_results=max_results),
            timeout=_READ_TIMEOUT_S,
        )
        return result
    except TimeoutError:
        from app.utils.exceptions import ValidationException

        raise ValidationException(f"File listing timed out after {_READ_TIMEOUT_S} seconds")


async def read_file(
    source_type: str,
    config: dict,
    ds_id: str,
    file_path: str,
) -> bytes:
    """Read a file from a data source. Returns the file content as bytes."""
    reader = _READERS.get(source_type)
    if not reader:
        from app.utils.exceptions import ValidationException

        raise ValidationException(f"File reading is not supported for source type: {source_type}")
    try:
        result = await asyncio.wait_for(
            reader(config, ds_id, file_path),
            timeout=_READ_TIMEOUT_S,
        )
        return result
    except TimeoutError:
        from app.utils.exceptions import ValidationException

        raise ValidationException(f"File reading timed out after {_READ_TIMEOUT_S} seconds")
