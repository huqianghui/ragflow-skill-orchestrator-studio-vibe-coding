"""Unit tests for the target tester dispatcher."""

from unittest.mock import patch

import pytest

from app.services.target_tester import TestResult, run_target_test


async def test_unknown_target_type():
    result = await run_target_test("unknown_type", {})
    assert result.success is False
    assert "Unknown target type" in result.message


async def test_dispatcher_catches_exception():
    """If a tester raises an unexpected exception, the dispatcher catches it."""

    async def boom_tester(_config: dict):
        raise Exception("boom")

    with patch.dict(
        "app.services.target_tester._TESTERS",
        {"azure_ai_search": boom_tester},
    ):
        result = await run_target_test("azure_ai_search", {"endpoint": "x", "api_key": "y"})
    assert result.success is False
    assert "boom" in result.message


async def test_dispatcher_timeout():
    """If a tester takes too long, the dispatcher returns a timeout error."""

    async def slow_tester(_config: dict) -> TestResult:
        import asyncio

        await asyncio.sleep(60)
        return TestResult(True, "should not reach")

    with (
        patch.dict(
            "app.services.target_tester._TESTERS",
            {"azure_ai_search": slow_tester},
        ),
        patch("app.services.target_tester._TEST_TIMEOUT_S", 0.1),
    ):
        result = await run_target_test("azure_ai_search", {})
    assert result.success is False
    assert "timed out" in result.message


async def test_neo4j_missing_import():
    """Neo4j tester returns helpful error when neo4j package is not installed."""
    with patch.dict("sys.modules", {"neo4j": None}):
        result = await run_target_test(
            "neo4j",
            {"uri": "bolt://x", "username": "u", "password": "p"},
        )
    assert result.success is False


async def test_mysql_missing_import():
    """MySQL tester returns helpful error when pymysql is not installed."""
    with patch.dict("sys.modules", {"pymysql": None}):
        result = await run_target_test(
            "mysql",
            {"host": "x", "username": "u", "password": "p", "database": "d"},
        )
    assert result.success is False


async def test_postgresql_missing_import():
    """PostgreSQL tester returns helpful error when psycopg2 is not installed."""
    with patch.dict("sys.modules", {"psycopg2": None}):
        result = await run_target_test(
            "postgresql",
            {"host": "x", "username": "u", "password": "p", "database": "d"},
        )
    assert result.success is False


@pytest.mark.parametrize(
    "target_type",
    [
        "azure_ai_search",
        "azure_blob",
        "cosmosdb_gremlin",
        "neo4j",
        "mysql",
        "postgresql",
    ],
)
async def test_all_target_types_registered(target_type):
    """Every target type has a tester function registered."""
    from app.services.target_tester import _TESTERS

    assert target_type in _TESTERS
