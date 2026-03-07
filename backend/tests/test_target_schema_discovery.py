"""Unit tests for the target schema discovery dispatcher."""

from unittest.mock import patch

import pytest

from app.services.target_schema_discovery import discover_schema


async def test_unknown_target_type():
    result = await discover_schema("unknown_type", {})
    assert result.exists is False
    assert result.schema_fields is None


async def test_azure_blob_returns_no_schema():
    result = await discover_schema("azure_blob", {})
    assert result.exists is True
    assert result.schema_fields is None


async def test_dispatcher_catches_exception():
    """If a discoverer raises an exception, the dispatcher catches it."""

    async def boom(_config: dict):
        raise Exception("discovery boom")

    with patch.dict(
        "app.services.target_schema_discovery._DISCOVERERS",
        {"azure_ai_search": boom},
    ):
        result = await discover_schema("azure_ai_search", {})
    assert result.exists is False


async def test_neo4j_missing_import():
    """Neo4j discoverer handles missing import."""
    with patch.dict("sys.modules", {"neo4j": None}):
        result = await discover_schema(
            "neo4j",
            {"uri": "bolt://x", "username": "u", "password": "p"},
        )
    assert result.exists is False


async def test_mysql_missing_import():
    with patch.dict("sys.modules", {"pymysql": None}):
        result = await discover_schema(
            "mysql",
            {"host": "x", "username": "u", "password": "p", "database": "d", "table_name": "t"},
        )
    assert result.exists is False


async def test_postgresql_missing_import():
    with patch.dict("sys.modules", {"psycopg2": None}):
        result = await discover_schema(
            "postgresql",
            {"host": "x", "username": "u", "password": "p", "database": "d", "table_name": "t"},
        )
    assert result.exists is False


async def test_mysql_no_table_name():
    """MySQL discoverer returns not found when table_name is missing."""
    result = await discover_schema(
        "mysql",
        {"host": "x", "username": "u", "password": "p", "database": "d"},
    )
    assert result.exists is False


async def test_postgresql_no_table_name():
    """PostgreSQL discoverer returns not found when table_name is missing."""
    result = await discover_schema(
        "postgresql",
        {"host": "x", "username": "u", "password": "p", "database": "d"},
    )
    assert result.exists is False


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
    """Every target type has a discoverer function registered."""
    from app.services.target_schema_discovery import _DISCOVERERS

    assert target_type in _DISCOVERERS
