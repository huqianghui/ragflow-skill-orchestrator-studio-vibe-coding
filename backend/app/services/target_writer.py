"""Writer services for each output target type."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class WriteResult:
    success: bool
    records_written: int
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Azure AI Search
# ---------------------------------------------------------------------------


async def _write_azure_ai_search(
    config: dict, field_mappings: dict, records: list[dict]
) -> WriteResult:
    from azure.core.credentials import AzureKeyCredential
    from azure.search.documents import SearchClient

    client = SearchClient(
        endpoint=config["endpoint"],
        index_name=config["index_name"],
        credential=AzureKeyCredential(config["api_key"]),
    )

    errors: list[str] = []
    written = 0
    batch_size = 1000

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        try:
            result = client.merge_or_upload_documents(documents=batch)
            for r in result:
                if r.succeeded:
                    written += 1
                else:
                    errors.append(f"Document failed: {r.key} - {r.error_message}")
        except Exception as exc:
            errors.append(f"Batch {i // batch_size} failed: {exc}")

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# Azure Blob Storage
# ---------------------------------------------------------------------------


def _expand_path_template(template: str, context: dict, index: int = 0) -> str:
    """Expand a blob path template with variables."""
    now = datetime.now(tz=UTC)
    variables = {
        "pipeline_name": context.get("pipeline_name", "unknown"),
        "pipeline_id": context.get("pipeline_id", "unknown"),
        "source_file": context.get("source_file", "document"),
        "source_ext": context.get("source_ext", ""),
        "timestamp": now.strftime("%Y%m%d_%H%M%S"),
        "date": now.strftime("%Y-%m-%d"),
        "output_name": context.get("output_name", "output"),
        "index": str(index),
    }
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", value)
    return result


async def _write_azure_blob(config: dict, field_mappings: dict, records: list[dict]) -> WriteResult:
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(config["connection_string"])
    container = client.get_container_client(config["container_name"])
    template = config.get("output_path_template", "{date}_{index}.json")
    content_format = config.get("content_format", "json")

    errors: list[str] = []
    written = 0
    context = {
        "pipeline_name": field_mappings.get("pipeline_name", "pipeline"),
        "pipeline_id": field_mappings.get("pipeline_id", ""),
        "source_file": field_mappings.get("source_file", "document"),
    }

    for i, record in enumerate(records):
        blob_path = _expand_path_template(template, context, index=i)
        try:
            if content_format == "json":
                data = json.dumps(record, ensure_ascii=False)
            elif content_format == "text":
                data = str(record.get("content", ""))
            elif content_format == "jsonl":
                data = json.dumps(record, ensure_ascii=False) + "\n"
            else:
                data = json.dumps(record, ensure_ascii=False)

            blob = container.get_blob_client(blob_path)
            blob.upload_blob(data, overwrite=True)
            written += 1
        except Exception as exc:
            errors.append(f"Blob '{blob_path}' failed: {exc}")

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# CosmosDB Gremlin
# ---------------------------------------------------------------------------


async def _write_cosmosdb_gremlin(
    config: dict, field_mappings: dict, records: list[dict]
) -> WriteResult:
    from gremlin_python.driver import client as gremlin_client
    from gremlin_python.driver import serializer

    client = gremlin_client.Client(
        url=config["endpoint"],
        traversal_source="g",
        username=f"/dbs/{config['database']}/colls/{config['graph']}",
        password=config["primary_key"],
        message_serializer=serializer.GraphSONSerializersV2d0(),
    )

    graph_mapping = field_mappings.get("graph_mapping", {})
    partition_key = config.get("partition_key", "pk")
    errors: list[str] = []
    written = 0

    try:
        # Write vertices
        for record in records:
            vertices = record.get("vertices", [])
            for v in vertices:
                vid = v.get(graph_mapping.get("vertex_id_field", "id"))
                label = v.get(graph_mapping.get("vertex_label_field", "label"), "vertex")
                skip = (
                    graph_mapping.get("vertex_id_field"),
                    graph_mapping.get("vertex_label_field"),
                )
                props = {k: v_val for k, v_val in v.items() if k not in skip}
                # Inject partition key
                props[partition_key] = vid

                prop_str = "".join(f".property('{k}', '{v_val}')" for k, v_val in props.items())
                query = f"g.addV('{label}').property('id', '{vid}'){prop_str}"
                try:
                    client.submit(query).all().result()
                    written += 1
                except Exception as exc:
                    errors.append(f"Vertex '{vid}' failed: {exc}")

            # Write edges
            edges = record.get("edges", [])
            for e in edges:
                label = e.get(graph_mapping.get("edge_label_field", "label"), "edge")
                src_id = e.get(graph_mapping.get("edge_source_id_field", "source_id"))
                tgt_id = e.get(graph_mapping.get("edge_target_id_field", "target_id"))
                props = {
                    k: e_val
                    for k, e_val in e.items()
                    if k
                    not in (
                        graph_mapping.get("edge_label_field"),
                        graph_mapping.get("edge_source_id_field"),
                        graph_mapping.get("edge_target_id_field"),
                    )
                }

                prop_str = "".join(f".property('{k}', '{v_val}')" for k, v_val in props.items())
                query = f"g.V('{src_id}').addE('{label}').to(g.V('{tgt_id}')){prop_str}"
                try:
                    client.submit(query).all().result()
                    written += 1
                except Exception as exc:
                    errors.append(f"Edge '{src_id}'->{tgt_id}' failed: {exc}")
    finally:
        client.close()

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# Neo4j
# ---------------------------------------------------------------------------


async def _write_neo4j(config: dict, field_mappings: dict, records: list[dict]) -> WriteResult:
    try:
        from neo4j import GraphDatabase
    except ImportError:
        return WriteResult(
            success=False,
            records_written=0,
            errors=["Neo4j requires extra dependencies: pip install '.[neo4j]'"],
        )

    graph_mapping = field_mappings.get("graph_mapping", {})
    driver = GraphDatabase.driver(config["uri"], auth=(config["username"], config["password"]))
    errors: list[str] = []
    written = 0

    try:
        with driver.session(database=config.get("database", "neo4j")) as session:
            for record in records:
                # Write vertices
                for v in record.get("vertices", []):
                    vid = v.get(graph_mapping.get("vertex_id_field", "id"))
                    label = v.get(graph_mapping.get("vertex_label_field", "label"), "Node")
                    props = {
                        k: val
                        for k, val in v.items()
                        if k
                        not in (
                            graph_mapping.get("vertex_id_field"),
                            graph_mapping.get("vertex_label_field"),
                        )
                    }
                    try:
                        session.run(
                            f"MERGE (n:{label} {{id: $id}}) SET n += $props",
                            id=vid,
                            props=props,
                        )
                        written += 1
                    except Exception as exc:
                        errors.append(f"Vertex '{vid}' failed: {exc}")

                # Write edges
                for e in record.get("edges", []):
                    label = e.get(graph_mapping.get("edge_label_field", "label"), "RELATES_TO")
                    src_id = e.get(graph_mapping.get("edge_source_id_field", "source_id"))
                    tgt_id = e.get(graph_mapping.get("edge_target_id_field", "target_id"))
                    props = {
                        k: val
                        for k, val in e.items()
                        if k
                        not in (
                            graph_mapping.get("edge_label_field"),
                            graph_mapping.get("edge_source_id_field"),
                            graph_mapping.get("edge_target_id_field"),
                        )
                    }
                    try:
                        session.run(
                            f"MATCH (a {{id: $src}}), (b {{id: $tgt}}) "
                            f"MERGE (a)-[r:{label}]->(b) SET r += $props",
                            src=src_id,
                            tgt=tgt_id,
                            props=props,
                        )
                        written += 1
                    except Exception as exc:
                        errors.append(f"Edge '{src_id}'->{tgt_id}' failed: {exc}")
    finally:
        driver.close()

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# MySQL
# ---------------------------------------------------------------------------


async def _write_mysql(config: dict, field_mappings: dict, records: list[dict]) -> WriteResult:
    try:
        import pymysql
    except ImportError:
        return WriteResult(
            success=False,
            records_written=0,
            errors=["MySQL requires extra dependencies: pip install '.[mysql]'"],
        )

    table_name = config.get("table_name", "output")
    conn = pymysql.connect(
        host=config["host"],
        port=int(config.get("port", 3306)),
        user=config["username"],
        password=config["password"],
        database=config["database"],
    )
    errors: list[str] = []
    written = 0

    try:
        with conn.cursor() as cursor:
            for record in records:
                cols = list(record.keys())
                placeholders = ", ".join(["%s"] * len(cols))
                col_names = ", ".join(f"`{c}`" for c in cols)
                update_clause = ", ".join(f"`{c}` = VALUES(`{c}`)" for c in cols)
                sql = (
                    f"INSERT INTO `{table_name}` ({col_names}) "  # noqa: S608
                    f"VALUES ({placeholders}) "
                    f"ON DUPLICATE KEY UPDATE {update_clause}"
                )
                try:
                    cursor.execute(sql, list(record.values()))
                    written += 1
                except Exception as exc:
                    errors.append(f"Record insert failed: {exc}")
            conn.commit()
    finally:
        conn.close()

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------


async def _write_postgresql(config: dict, field_mappings: dict, records: list[dict]) -> WriteResult:
    try:
        import psycopg2
    except ImportError:
        return WriteResult(
            success=False,
            records_written=0,
            errors=["PostgreSQL requires extra dependencies: pip install '.[postgresql]'"],
        )

    table_name = config.get("table_name", "output")
    schema_name = config.get("schema_name", "public")
    key_field = field_mappings.get("key_field", {})
    key_col = key_field.get("target", "id")

    conn = psycopg2.connect(
        host=config["host"],
        port=int(config.get("port", 5432)),
        user=config["username"],
        password=config["password"],
        dbname=config["database"],
    )
    errors: list[str] = []
    written = 0

    try:
        with conn.cursor() as cursor:
            for record in records:
                cols = list(record.keys())
                placeholders = ", ".join(["%s"] * len(cols))
                col_names = ", ".join(f'"{c}"' for c in cols)
                update_clause = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in cols if c != key_col)
                sql = (
                    f'INSERT INTO "{schema_name}"."{table_name}" ({col_names}) '
                    f"VALUES ({placeholders}) "
                    f'ON CONFLICT ("{key_col}") DO UPDATE SET {update_clause}'
                )
                try:
                    cursor.execute(sql, list(record.values()))
                    written += 1
                except Exception as exc:
                    errors.append(f"Record insert failed: {exc}")
            conn.commit()
    finally:
        conn.close()

    return WriteResult(success=len(errors) == 0, records_written=written, errors=errors)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_WRITERS: dict[str, object] = {
    "azure_ai_search": _write_azure_ai_search,
    "azure_blob": _write_azure_blob,
    "cosmosdb_gremlin": _write_cosmosdb_gremlin,
    "neo4j": _write_neo4j,
    "mysql": _write_mysql,
    "postgresql": _write_postgresql,
}


async def write_to_target(
    target_type: str,
    config: dict,
    field_mappings: dict,
    records: list[dict],
) -> WriteResult:
    """Write records to an output target."""
    writer = _WRITERS.get(target_type)
    if not writer:
        return WriteResult(
            success=False,
            records_written=0,
            errors=[f"Unknown target type: {target_type}"],
        )
    try:
        return await writer(config, field_mappings, records)
    except Exception as exc:
        return WriteResult(success=False, records_written=0, errors=[str(exc)])
