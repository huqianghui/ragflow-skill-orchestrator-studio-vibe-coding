from datetime import datetime

from pydantic import BaseModel, Field

SOURCE_TYPES = (
    "local_upload",
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
)

_SOURCE_TYPE_PATTERN = r"^(" + "|".join(SOURCE_TYPES) + r")$"

# Fields that contain secrets per source type
SECRET_FIELDS: dict[str, list[str]] = {
    "azure_blob": ["connection_string"],
    "azure_adls_gen2": ["account_key"],
    "azure_cosmos_db": ["connection_string"],
    "azure_sql": ["connection_string"],
    "azure_table": ["connection_string"],
    "microsoft_onelake": ["client_secret"],
    "sharepoint": ["client_secret"],
    "onedrive": ["client_secret"],
    "onedrive_business": ["client_secret"],
    "azure_file_storage": ["connection_string"],
    "azure_queues": ["connection_string"],
    "service_bus": ["connection_string"],
    "amazon_s3": ["access_key_id", "secret_access_key"],
    "dropbox": ["access_token"],
    "sftp_ssh": ["password", "private_key"],
}


def mask_secret(value: str) -> str:
    if not value or len(value) <= 8:
        return "****"
    return f"{value[:4]}****{value[-4:]}"


def mask_config(config: dict, source_type: str) -> dict:
    """Replace secret fields in config with masked values."""
    fields = SECRET_FIELDS.get(source_type, [])
    masked = config.copy()
    for field in fields:
        if field in masked and masked[field]:
            masked[field] = mask_secret(masked[field])
    return masked


class DataSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    source_type: str = Field(..., pattern=_SOURCE_TYPE_PATTERN)
    connection_config: dict = Field(default_factory=dict)
    pipeline_id: str | None = None


class DataSourceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    connection_config: dict | None = None
    status: str | None = Field(default=None, pattern=r"^(active|inactive|error)$")
    pipeline_id: str | None = None


class DataSourceResponse(BaseModel):
    id: str
    name: str
    description: str | None
    source_type: str
    connection_config: dict
    status: str
    file_count: int
    total_size: int
    pipeline_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataSourceTestResult(BaseModel):
    success: bool
    message: str


class UploadQuotaInfo(BaseModel):
    total_mb: int
    used_mb: float
    available_mb: float
    retention_days: int
    max_file_size_mb: int
    temp_dir: str
