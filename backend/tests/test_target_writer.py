"""Unit tests for the target writer dispatcher."""

from unittest.mock import patch

import pytest

from app.services.target_writer import WriteResult, write_to_target


async def test_unknown_target_type():
    result = await write_to_target("unknown_type", {}, {}, [])
    assert result.success is False
    assert "Unknown target type" in result.errors[0]


async def test_dispatcher_catches_exception():
    """If a writer raises an exception, the dispatcher catches it."""

    async def boom(_config, _mappings, _records):
        raise Exception("write boom")

    with patch.dict(
        "app.services.target_writer._WRITERS",
        {"azure_ai_search": boom},
    ):
        result = await write_to_target("azure_ai_search", {}, {}, [{"id": "1"}])
    assert result.success is False
    assert "write boom" in result.errors[0]


async def test_neo4j_missing_import():
    with patch.dict("sys.modules", {"neo4j": None}):
        result = await write_to_target(
            "neo4j",
            {"uri": "bolt://x", "username": "u", "password": "p"},
            {"graph_mapping": {}},
            [{"vertices": [], "edges": []}],
        )
    assert result.success is False


async def test_mysql_missing_import():
    with patch.dict("sys.modules", {"pymysql": None}):
        result = await write_to_target(
            "mysql",
            {"host": "x", "username": "u", "password": "p", "database": "d"},
            {},
            [{"id": "1"}],
        )
    assert result.success is False


async def test_postgresql_missing_import():
    with patch.dict("sys.modules", {"psycopg2": None}):
        result = await write_to_target(
            "postgresql",
            {"host": "x", "username": "u", "password": "p", "database": "d"},
            {},
            [{"id": "1"}],
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
    from app.services.target_writer import _WRITERS

    assert target_type in _WRITERS


async def test_write_result_defaults():
    r = WriteResult(success=True, records_written=5)
    assert r.errors == []
    assert r.records_written == 5
