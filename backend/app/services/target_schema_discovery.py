"""Schema discovery for each output target type."""

from __future__ import annotations

from app.schemas.target import TargetSchemaDiscovery, TargetSchemaField

_DISCOVER_TIMEOUT_S = 30


# ---------------------------------------------------------------------------
# Azure AI Search
# ---------------------------------------------------------------------------


def _ai_search_type_to_str(field_type: str) -> str:
    """Normalize Azure AI Search field types to simple strings."""
    mapping = {
        "Edm.String": "string",
        "Edm.Int32": "int",
        "Edm.Int64": "int",
        "Edm.Double": "float",
        "Edm.Boolean": "boolean",
        "Edm.DateTimeOffset": "datetime",
        "Collection(Edm.Single)": "vector",
        "Collection(Edm.String)": "array",
    }
    return mapping.get(str(field_type), str(field_type))


async def _discover_azure_ai_search(config: dict) -> TargetSchemaDiscovery:
    from azure.core.credentials import AzureKeyCredential
    from azure.core.exceptions import ResourceNotFoundError
    from azure.search.documents.indexes import SearchIndexClient

    client = SearchIndexClient(
        endpoint=config["endpoint"],
        credential=AzureKeyCredential(config["api_key"]),
    )
    index_name = config.get("index_name", "")
    if not index_name:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)
    try:
        index = client.get_index(index_name)
    except ResourceNotFoundError:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    fields = []
    for f in index.fields:
        vec_cfg = None
        if hasattr(f, "vector_search_dimensions") and f.vector_search_dimensions:
            vec_cfg = {"dimensions": f.vector_search_dimensions}
            if hasattr(f, "vector_search_profile_name") and f.vector_search_profile_name:
                vec_cfg["profile"] = f.vector_search_profile_name
        fields.append(
            TargetSchemaField(
                name=f.name,
                type=_ai_search_type_to_str(str(f.type)),
                searchable=getattr(f, "searchable", None),
                filterable=getattr(f, "filterable", None),
                key=getattr(f, "key", None),
                vector_config=vec_cfg,
            )
        )
    return TargetSchemaDiscovery(exists=True, schema_fields=fields)


# ---------------------------------------------------------------------------
# Azure Blob (no schema)
# ---------------------------------------------------------------------------


async def _discover_azure_blob(_config: dict) -> TargetSchemaDiscovery:
    return TargetSchemaDiscovery(exists=True, schema_fields=None)


# ---------------------------------------------------------------------------
# CosmosDB Gremlin
# ---------------------------------------------------------------------------


async def _discover_cosmosdb_gremlin(config: dict) -> TargetSchemaDiscovery:
    from gremlin_python.driver import client as gremlin_client
    from gremlin_python.driver import serializer

    client = gremlin_client.Client(
        url=config["endpoint"],
        traversal_source="g",
        username=f"/dbs/{config['database']}/colls/{config['graph']}",
        password=config["primary_key"],
        message_serializer=serializer.GraphSONSerializersV2d0(),
    )
    try:
        labels = client.submit("g.V().label().dedup()").all().result()
        props = client.submit("g.V().properties().key().dedup()").all().result()
    finally:
        client.close()

    fields = [TargetSchemaField(name=f"label:{lbl}", type="label") for lbl in labels]
    fields.extend(TargetSchemaField(name=p, type="string") for p in props)
    return TargetSchemaDiscovery(exists=True, schema_fields=fields)


# ---------------------------------------------------------------------------
# Neo4j
# ---------------------------------------------------------------------------


async def _discover_neo4j(config: dict) -> TargetSchemaDiscovery:
    try:
        from neo4j import GraphDatabase
    except ImportError:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    driver = GraphDatabase.driver(config["uri"], auth=(config["username"], config["password"]))
    try:
        with driver.session(database=config.get("database", "neo4j")) as session:
            labels_result = session.run("CALL db.labels()")
            labels = [r["label"] for r in labels_result]

            props_result = session.run(
                "CALL db.schema.nodeTypeProperties() YIELD nodeLabels, propertyName, propertyTypes"
            )
            fields = []
            for lbl in labels:
                fields.append(TargetSchemaField(name=f"label:{lbl}", type="label"))
            for r in props_result:
                prop_type = r["propertyTypes"][0] if r["propertyTypes"] else "string"
                fields.append(TargetSchemaField(name=r["propertyName"], type=prop_type))
    finally:
        driver.close()
    return TargetSchemaDiscovery(exists=True, schema_fields=fields)


# ---------------------------------------------------------------------------
# MySQL
# ---------------------------------------------------------------------------


async def _discover_mysql(config: dict) -> TargetSchemaDiscovery:
    try:
        import pymysql
    except ImportError:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    table_name = config.get("table_name", "")
    if not table_name:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    conn = pymysql.connect(
        host=config["host"],
        port=int(config.get("port", 3306)),
        user=config["username"],
        password=config["password"],
        database=config["database"],
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE `{table_name}`")  # noqa: S608
            rows = cursor.fetchall()
    except pymysql.err.ProgrammingError:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)
    finally:
        conn.close()

    fields = []
    for row in rows:
        fields.append(
            TargetSchemaField(
                name=row[0],
                type=row[1],
                nullable=row[2] == "YES",
                key=row[3] == "PRI",
            )
        )
    return TargetSchemaDiscovery(exists=True, schema_fields=fields)


# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------


async def _discover_postgresql(config: dict) -> TargetSchemaDiscovery:
    try:
        import psycopg2
    except ImportError:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    table_name = config.get("table_name", "")
    schema_name = config.get("schema_name", "public")
    if not table_name:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    conn = psycopg2.connect(
        host=config["host"],
        port=int(config.get("port", 5432)),
        user=config["username"],
        password=config["password"],
        dbname=config["database"],
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT column_name, data_type, is_nullable, column_default "
                "FROM information_schema.columns "
                "WHERE table_schema = %s AND table_name = %s "
                "ORDER BY ordinal_position",
                (schema_name, table_name),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    if not rows:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)

    fields = []
    for row in rows:
        fields.append(
            TargetSchemaField(
                name=row[0],
                type=row[1],
                nullable=row[2] == "YES",
            )
        )
    return TargetSchemaDiscovery(exists=True, schema_fields=fields)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_DISCOVERERS: dict[str, object] = {
    "azure_ai_search": _discover_azure_ai_search,
    "azure_blob": _discover_azure_blob,
    "cosmosdb_gremlin": _discover_cosmosdb_gremlin,
    "neo4j": _discover_neo4j,
    "mysql": _discover_mysql,
    "postgresql": _discover_postgresql,
}


async def discover_schema(target_type: str, config: dict) -> TargetSchemaDiscovery:
    """Discover the schema of an output target."""
    discoverer = _DISCOVERERS.get(target_type)
    if not discoverer:
        return TargetSchemaDiscovery(exists=False, schema_fields=None)
    try:
        return await discoverer(config)
    except Exception as exc:
        return TargetSchemaDiscovery(
            exists=False,
            schema_fields=None,
            suggested_schema=[
                TargetSchemaField(name="error", type=str(exc)),
            ],
        )
