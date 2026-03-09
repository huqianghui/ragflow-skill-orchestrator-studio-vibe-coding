import os
import tempfile
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.services.data_source_reader import FileInfo, list_files, read_file


@pytest.mark.asyncio
async def test_list_local_upload_empty():
    """list_files returns empty list when no files exist."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            files = await list_files("local_upload", {}, "nonexistent-ds")
    assert files == []


@pytest.mark.asyncio
async def test_list_local_upload_with_files():
    """list_files returns FileInfo for each file in the ds directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ds_id = "test-ds-001"
        ds_dir = os.path.join(tmpdir, ds_id)
        os.makedirs(ds_dir)

        # Create test files
        for name in ["doc.pdf", "image.png", "data.csv"]:
            path = os.path.join(ds_dir, name)
            with open(path, "wb") as f:
                f.write(b"test content " + name.encode())

        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            files = await list_files("local_upload", {}, ds_id)

    assert len(files) == 3
    names = [f.name for f in files]
    assert "doc.pdf" in names
    assert "image.png" in names
    assert "data.csv" in names

    pdf = next(f for f in files if f.name == "doc.pdf")
    assert pdf.size > 0
    assert pdf.mime_type == "application/pdf"
    assert pdf.etag is not None


@pytest.mark.asyncio
async def test_read_local_upload():
    """read_file returns file content."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ds_id = "test-ds-002"
        ds_dir = os.path.join(tmpdir, ds_id)
        os.makedirs(ds_dir)

        content = b"Hello, World!"
        with open(os.path.join(ds_dir, "hello.txt"), "wb") as f:
            f.write(content)

        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            result = await read_file("local_upload", {}, ds_id, "hello.txt")

    assert result == content


@pytest.mark.asyncio
async def test_read_local_upload_path_traversal():
    """read_file rejects path traversal attempts."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ds_id = "test-ds-003"
        ds_dir = os.path.join(tmpdir, ds_id)
        os.makedirs(ds_dir)

        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            with pytest.raises(ValueError, match="path traversal"):
                await read_file("local_upload", {}, ds_id, "../../../etc/passwd")


@pytest.mark.asyncio
async def test_read_local_upload_file_not_found():
    """read_file raises FileNotFoundError for missing files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ds_id = "test-ds-004"
        ds_dir = os.path.join(tmpdir, ds_id)
        os.makedirs(ds_dir)

        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            with pytest.raises(FileNotFoundError):
                await read_file("local_upload", {}, ds_id, "nonexistent.txt")


@pytest.mark.asyncio
async def test_list_unsupported_type():
    """list_files raises ValidationException for unsupported types."""
    from app.utils.exceptions import ValidationException

    with pytest.raises(ValidationException, match="not supported"):
        await list_files("azure_cosmos_db", {}, "ds-id")


@pytest.mark.asyncio
async def test_read_unsupported_type():
    """read_file raises ValidationException for unsupported types."""
    from app.utils.exceptions import ValidationException

    with pytest.raises(ValidationException, match="not supported"):
        await read_file("azure_cosmos_db", {}, "ds-id", "file.txt")


@pytest.mark.asyncio
async def test_fileinfo_model():
    """FileInfo model can be created and serialized."""
    info = FileInfo(name="test.pdf", path="docs/test.pdf", size=1024)
    assert info.name == "test.pdf"
    assert info.mime_type is None
    data = info.model_dump()
    assert data["name"] == "test.pdf"
    assert data["size"] == 1024


# --- API endpoint integration test ---


@pytest.mark.asyncio
async def test_list_files_api_not_found(client: AsyncClient):
    """GET /data-sources/{id}/files returns 404 for nonexistent ds."""
    response = await client.get("/api/v1/data-sources/nonexistent-id/files")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_files_api_local_upload(client: AsyncClient):
    """GET /data-sources/{id}/files returns files for local_upload ds."""
    # Create a local_upload data source
    create_resp = await client.post(
        "/api/v1/data-sources",
        json={
            "name": "test-local",
            "source_type": "local_upload",
            "connection_config": {},
        },
    )
    assert create_resp.status_code == 201
    ds_id = create_resp.json()["id"]

    with tempfile.TemporaryDirectory() as tmpdir:
        # Create files in the ds directory
        ds_dir = os.path.join(tmpdir, ds_id)
        os.makedirs(ds_dir)
        with open(os.path.join(ds_dir, "test.txt"), "wb") as f:
            f.write(b"test content")

        with patch("app.services.data_source_reader.get_settings") as mock_settings:
            mock_settings.return_value.upload_temp_dir = tmpdir
            response = await client.get(f"/api/v1/data-sources/{ds_id}/files")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "test.txt"
    assert data[0]["size"] > 0
