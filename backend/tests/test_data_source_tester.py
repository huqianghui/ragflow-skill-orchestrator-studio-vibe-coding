"""Unit tests for the data source tester dispatcher."""

from unittest.mock import patch

import pytest

from app.services.data_source_tester import TestResult, run_connectivity_test


async def test_unknown_source_type():
    result = await run_connectivity_test("unknown_type", {})
    assert result.success is False
    assert "Unknown source type" in result.message


async def test_local_upload_writable(tmp_path):
    with patch("app.services.data_source_tester.get_settings") as mock_settings:
        mock_settings.return_value.upload_temp_dir = str(tmp_path)
        result = await run_connectivity_test("local_upload", {})
    assert result.success is True
    assert "ready" in result.message


async def test_local_upload_creates_dir(tmp_path):
    new_dir = tmp_path / "subdir" / "uploads"
    with patch("app.services.data_source_tester.get_settings") as mock_settings:
        mock_settings.return_value.upload_temp_dir = str(new_dir)
        result = await run_connectivity_test("local_upload", {})
    assert result.success is True
    assert new_dir.is_dir()


async def test_dispatcher_catches_exception():
    """If a tester raises an unexpected exception, the dispatcher catches it."""

    async def boom_tester(_config: dict):
        raise Exception("boom")

    with patch.dict(
        "app.services.data_source_tester._TESTERS",
        {"azure_blob": boom_tester},
    ):
        config = {"connection_string": "x", "container_name": "c"}
        result = await run_connectivity_test("azure_blob", config)
    assert result.success is False
    assert "boom" in result.message


async def test_amazon_s3_missing_import():
    """S3 tester returns helpful error when boto3 is not installed."""
    with patch.dict("sys.modules", {"boto3": None}):
        # The import check inside the function won't find boto3
        result = await run_connectivity_test(
            "amazon_s3",
            {
                "access_key_id": "x",
                "secret_access_key": "y",
                "bucket_name": "b",
                "region": "us-east-1",
            },
        )
    # Either it fails with import error or with the generic catch
    assert result.success is False


async def test_dispatcher_timeout():
    """If a tester takes too long, the dispatcher returns a timeout error."""

    async def slow_tester(_config: dict) -> TestResult:
        import asyncio

        await asyncio.sleep(60)
        return TestResult(True, "should not reach")

    with (
        patch.dict(
            "app.services.data_source_tester._TESTERS",
            {"azure_blob": slow_tester},
        ),
        patch("app.services.data_source_tester._TEST_TIMEOUT_S", 0.1),
    ):
        result = await run_connectivity_test("azure_blob", {})
    assert result.success is False
    assert "timed out" in result.message


@pytest.mark.parametrize(
    "source_type",
    [
        "azure_blob",
        "azure_adls_gen2",
        "azure_cosmos_db",
        "azure_sql",
        "azure_table",
        "microsoft_onelake",
        "sharepoint",
        "onedrive",
        "onedrive_business",
        "azure_file_storage",
        "azure_queues",
        "service_bus",
        "amazon_s3",
        "dropbox",
        "sftp_ssh",
    ],
)
async def test_all_types_registered(source_type):
    """Every source type has a tester function registered."""
    from app.services.data_source_tester import _TESTERS

    assert source_type in _TESTERS
