"""Azure AI Search index schema inference and creation."""

from __future__ import annotations

from app.schemas.target import TargetSchemaField

# Model name → embedding dimensions lookup table
_MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-ada-002": 1536,
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}

_DEFAULT_DIMENSIONS = 1536

# Pipeline output type → AI Search field type
_TYPE_TO_EDM: dict[str, str] = {
    "string": "Edm.String",
    "int": "Edm.Int64",
    "float": "Edm.Double",
    "boolean": "Edm.Boolean",
    "datetime": "Edm.DateTimeOffset",
    "array": "Collection(Edm.String)",
    "vector": "Collection(Edm.Single)",
}


def _infer_vector_dimensions(pipeline: dict, field_mappings: dict | None = None) -> int:
    """Infer vector dimensions from field_mappings or Pipeline TextEmbedder config."""
    # Priority 1: explicit vector_config in field_mappings
    if field_mappings:
        for m in field_mappings.get("mappings", []):
            vc = m.get("vector_config")
            if vc and vc.get("dimensions"):
                return int(vc["dimensions"])

    # Priority 2 & 3: Pipeline TextEmbedder node config
    nodes = pipeline.get("graph_data", {}).get("nodes", [])
    for node in nodes:
        if node.get("skill_name") == "TextEmbedder":
            overrides = node.get("config_overrides", {})
            # Priority 2: explicit dimensions config
            if overrides.get("dimensions"):
                return int(overrides["dimensions"])
            # Priority 3: model_name lookup
            model = overrides.get("model_name", "")
            if model in _MODEL_DIMENSIONS:
                return _MODEL_DIMENSIONS[model]

    # Priority 4: default
    return _DEFAULT_DIMENSIONS


def _infer_pipeline_output_fields(pipeline: dict) -> list[dict]:
    """Extract output field paths from Pipeline graph_data nodes."""
    nodes = pipeline.get("graph_data", {}).get("nodes", [])
    nodes_sorted = sorted(nodes, key=lambda n: n.get("position", 0))

    fields: list[dict] = [
        {"path": "/document/file_content", "type": "string", "from_skill": "input"},
        {"path": "/document/file_name", "type": "string", "from_skill": "input"},
    ]

    for node in nodes_sorted:
        context = node.get("context", "/document")
        skill_name = node.get("skill_name", "")
        for output in node.get("outputs", []):
            target_name = output.get("targetName", output.get("name", ""))
            path = f"{context}/{target_name}"
            field_type = "string"
            vector_hint = None
            if skill_name == "TextEmbedder":
                field_type = "vector"
                overrides = node.get("config_overrides", {})
                model = overrides.get("model_name", "text-embedding-ada-002")
                dims = int(overrides.get("dimensions", _MODEL_DIMENSIONS.get(model, 1536)))
                vector_hint = {"model": model, "dimensions": dims}
            fields.append(
                {
                    "path": path,
                    "type": field_type,
                    "from_skill": skill_name,
                    "vector_hint": vector_hint,
                }
            )

    return fields


def infer_index_schema(
    pipeline: dict,
    field_mappings: dict | None = None,
) -> list[TargetSchemaField]:
    """Generate a suggested AI Search index schema from Pipeline output fields."""
    output_fields = _infer_pipeline_output_fields(pipeline)
    dimensions = _infer_vector_dimensions(pipeline, field_mappings)

    schema: list[TargetSchemaField] = []

    # Always add an id key field
    schema.append(
        TargetSchemaField(name="id", type="string", key=True, filterable=True, searchable=False)
    )

    for field in output_fields:
        # Use last segment of path as field name
        name = field["path"].rsplit("/", 1)[-1]
        # Skip wildcards and duplicates
        if name == "*" or any(s.name == name for s in schema):
            continue

        if field["type"] == "vector":
            schema.append(
                TargetSchemaField(
                    name=name,
                    type="vector",
                    searchable=True,
                    vector_config={"dimensions": dimensions, "algorithm": "hnsw"},
                )
            )
        else:
            edm_type = _TYPE_TO_EDM.get(field["type"], "Edm.String")
            schema.append(
                TargetSchemaField(
                    name=name,
                    type=field["type"],
                    searchable=edm_type == "Edm.String",
                    filterable=edm_type != "Edm.String",
                )
            )

    return schema


def _schema_to_index_fields(schema: list[TargetSchemaField]) -> list[dict]:
    """Convert TargetSchemaField list to Azure SearchIndex field definitions."""
    from azure.search.documents.indexes.models import (
        SearchableField,
        SearchField,
        SearchFieldDataType,
        SimpleField,
    )

    fields = []
    for sf in schema:
        if sf.type == "vector" and sf.vector_config:
            dims = sf.vector_config.get("dimensions", _DEFAULT_DIMENSIONS)
            fields.append(
                SearchField(
                    name=sf.name,
                    type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                    searchable=True,
                    vector_search_dimensions=dims,
                    vector_search_profile_name="default-vector-profile",
                )
            )
        elif sf.key:
            fields.append(SimpleField(name=sf.name, type=SearchFieldDataType.String, key=True))
        elif sf.searchable:
            fields.append(
                SearchableField(
                    name=sf.name,
                    type=SearchFieldDataType.String,
                    filterable=sf.filterable or False,
                )
            )
        else:
            edm = _TYPE_TO_EDM.get(sf.type, "Edm.String")
            fields.append(
                SimpleField(
                    name=sf.name,
                    type=edm,
                    filterable=sf.filterable or False,
                )
            )
    return fields


async def create_search_index(
    config: dict,
    schema: list[TargetSchemaField],
) -> dict:
    """Create an Azure AI Search index from a schema definition."""
    from azure.core.credentials import AzureKeyCredential
    from azure.search.documents.indexes import SearchIndexClient
    from azure.search.documents.indexes.models import (
        HnswAlgorithmConfiguration,
        SearchIndex,
        VectorSearch,
        VectorSearchProfile,
    )

    client = SearchIndexClient(
        endpoint=config["endpoint"],
        credential=AzureKeyCredential(config["api_key"]),
    )

    index_fields = _schema_to_index_fields(schema)

    # Check if any vector fields exist
    has_vectors = any(sf.type == "vector" for sf in schema)
    vector_search = None
    if has_vectors:
        vector_search = VectorSearch(
            algorithms=[HnswAlgorithmConfiguration(name="default-hnsw")],
            profiles=[
                VectorSearchProfile(
                    name="default-vector-profile",
                    algorithm_configuration_name="default-hnsw",
                )
            ],
        )

    index = SearchIndex(
        name=config["index_name"],
        fields=index_fields,
        vector_search=vector_search,
    )

    result = client.create_index(index)
    return {"name": result.name, "fields": len(result.fields)}
