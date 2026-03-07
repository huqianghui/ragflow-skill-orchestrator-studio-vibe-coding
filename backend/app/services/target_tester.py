"""Connectivity testers for each output target type."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

_TEST_TIMEOUT_S = 30


@dataclass
class TestResult:
    __test__ = False  # prevent pytest collection
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Azure (default dependencies)
# ---------------------------------------------------------------------------


async def _test_azure_ai_search(config: dict) -> TestResult:
    from azure.core.credentials import AzureKeyCredential
    from azure.search.documents.indexes import SearchIndexClient

    client = SearchIndexClient(
        endpoint=config["endpoint"],
        credential=AzureKeyCredential(config["api_key"]),
    )
    index_names = [name for name in client.list_index_names()]
    index_name = config.get("index_name", "")
    if index_name and index_name in index_names:
        return TestResult(True, f"Connected. Index '{index_name}' exists.")
    elif index_name:
        return TestResult(True, f"Connected. Index '{index_name}' not found (can be created).")
    else:
        return TestResult(True, f"Connected. {len(index_names)} index(es) available.")


async def _test_azure_blob(config: dict) -> TestResult:
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(config["connection_string"])
    container_name = config.get("container_name", "")
    container = client.get_container_client(container_name)
    props = container.get_container_properties()
    return TestResult(True, f"Connected to container '{props['name']}'")


async def _test_cosmosdb_gremlin(config: dict) -> TestResult:
    from gremlin_python.driver import client as gremlin_client
    from gremlin_python.driver import serializer

    endpoint = config["endpoint"]
    primary_key = config["primary_key"]
    database = config["database"]
    graph = config["graph"]

    client = gremlin_client.Client(
        url=endpoint,
        traversal_source="g",
        username=f"/dbs/{database}/colls/{graph}",
        password=primary_key,
        message_serializer=serializer.GraphSONSerializersV2d0(),
    )
    try:
        result = client.submit("g.V().limit(1)").all().result()
        vertex_count = len(result)
        return TestResult(
            True,
            f"Connected to graph '{database}/{graph}'. {vertex_count} vertex(es) sampled.",
        )
    finally:
        client.close()


# ---------------------------------------------------------------------------
# Extras-based (import check first)
# ---------------------------------------------------------------------------


async def _test_neo4j(config: dict) -> TestResult:
    try:
        from neo4j import GraphDatabase
    except ImportError:
        return TestResult(
            False,
            "Neo4j requires extra dependencies: pip install '.[neo4j]'",
        )
    uri = config["uri"]
    username = config["username"]
    password = config["password"]
    database = config.get("database", "neo4j")

    driver = GraphDatabase.driver(uri, auth=(username, password))
    try:
        with driver.session(database=database) as session:
            result = session.run("RETURN 1 AS n")
            result.single()
        return TestResult(True, f"Connected to Neo4j database '{database}'")
    finally:
        driver.close()


async def _test_mysql(config: dict) -> TestResult:
    try:
        import pymysql
    except ImportError:
        return TestResult(
            False,
            "MySQL requires extra dependencies: pip install '.[mysql]'",
        )
    conn = pymysql.connect(
        host=config["host"],
        port=int(config.get("port", 3306)),
        user=config["username"],
        password=config["password"],
        database=config["database"],
        connect_timeout=_TEST_TIMEOUT_S,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        return TestResult(True, f"Connected to MySQL database '{config['database']}'")
    finally:
        conn.close()


async def _test_postgresql(config: dict) -> TestResult:
    try:
        import psycopg2
    except ImportError:
        return TestResult(
            False,
            "PostgreSQL requires extra dependencies: pip install '.[postgresql]'",
        )
    conn = psycopg2.connect(
        host=config["host"],
        port=int(config.get("port", 5432)),
        user=config["username"],
        password=config["password"],
        dbname=config["database"],
        connect_timeout=_TEST_TIMEOUT_S,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        return TestResult(True, f"Connected to PostgreSQL database '{config['database']}'")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_TESTERS: dict[str, object] = {
    "azure_ai_search": _test_azure_ai_search,
    "azure_blob": _test_azure_blob,
    "cosmosdb_gremlin": _test_cosmosdb_gremlin,
    "neo4j": _test_neo4j,
    "mysql": _test_mysql,
    "postgresql": _test_postgresql,
}


async def run_target_test(target_type: str, config: dict) -> TestResult:
    """Test connectivity for an output target."""
    tester = _TESTERS.get(target_type)
    if not tester:
        return TestResult(False, f"Unknown target type: {target_type}")
    try:
        result = await asyncio.wait_for(tester(config), timeout=_TEST_TIMEOUT_S)
        return result
    except TimeoutError:
        return TestResult(False, f"Connection timed out after {_TEST_TIMEOUT_S} seconds")
    except Exception as exc:
        return TestResult(False, f"Connection failed: {exc}")
