"""Connectivity testers for each data source type."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass

from app.config import get_settings

_TEST_TIMEOUT_S = 30


@dataclass
class TestResult:
    __test__ = False  # prevent pytest collection
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Local
# ---------------------------------------------------------------------------


async def _test_local_upload(_config: dict) -> TestResult:
    settings = get_settings()
    temp_dir = settings.upload_temp_dir
    if not os.path.isdir(temp_dir):
        try:
            os.makedirs(temp_dir, exist_ok=True)
        except OSError as exc:
            return TestResult(False, f"Cannot create temp dir: {exc}")
    if not os.access(temp_dir, os.W_OK):
        return TestResult(False, f"Temp dir is not writable: {temp_dir}")
    return TestResult(True, f"Temp directory is ready: {temp_dir}")


# ---------------------------------------------------------------------------
# Azure Built-in Indexer
# ---------------------------------------------------------------------------


async def _test_azure_blob(config: dict) -> TestResult:
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(config["connection_string"])
    container_name = config.get("container_name", "")
    container = client.get_container_client(container_name)
    props = container.get_container_properties()
    return TestResult(True, f"Connected to container '{props['name']}'")


async def _test_azure_adls_gen2(config: dict) -> TestResult:
    from azure.storage.filedatalake import DataLakeServiceClient

    account_url = f"https://{config['account_name']}.dfs.core.windows.net"
    client = DataLakeServiceClient(account_url, credential=config["account_key"])
    fs = client.get_file_system_client(config["filesystem"])
    props = fs.get_file_system_properties()
    return TestResult(True, f"Connected to filesystem '{props['name']}'")


async def _test_azure_cosmos_db(config: dict) -> TestResult:
    from azure.cosmos import CosmosClient

    client = CosmosClient.from_connection_string(config["connection_string"])
    db = client.get_database_client(config["database"])
    db.read()
    container_name = config.get("container", "")
    if container_name:
        container = db.get_container_client(container_name)
        container.read()
    return TestResult(True, f"Connected to database '{config['database']}'")


async def _test_azure_sql(config: dict) -> TestResult:
    import pyodbc

    conn = pyodbc.connect(config["connection_string"], timeout=_TEST_TIMEOUT_S)
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    cursor.close()
    conn.close()
    return TestResult(True, "Connected to Azure SQL Database")


async def _test_azure_table(config: dict) -> TestResult:
    from azure.data.tables import TableServiceClient

    client = TableServiceClient.from_connection_string(config["connection_string"])
    table = client.get_table_client(config["table_name"])
    table.get_table_access_policy()
    return TestResult(True, f"Connected to table '{config['table_name']}'")


async def _test_microsoft_onelake(config: dict) -> TestResult:
    import httpx
    from azure.identity import ClientSecretCredential

    credential = ClientSecretCredential(
        tenant_id=config["tenant_id"],
        client_id=config["client_id"],
        client_secret=config["client_secret"],
    )
    token = credential.get_token("https://storage.azure.com/.default")
    workspace_id = config["workspace_id"]
    lakehouse_id = config["lakehouse_id"]
    url = f"https://onelake.dfs.fabric.microsoft.com/{workspace_id}/{lakehouse_id}"
    resp = httpx.get(
        url,
        headers={"Authorization": f"Bearer {token.token}"},
        params={"resource": "filesystem"},
        timeout=_TEST_TIMEOUT_S,
    )
    resp.raise_for_status()
    return TestResult(True, f"Connected to OneLake workspace '{workspace_id}'")


# ---------------------------------------------------------------------------
# Logic Apps Connector — Graph API based
# ---------------------------------------------------------------------------


async def _get_graph_token(config: dict) -> str:
    """Acquire a Microsoft Graph access token via client credentials."""
    import httpx

    url = f"https://login.microsoftonline.com/{config['tenant_id']}/oauth2/v2.0/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "scope": "https://graph.microsoft.com/.default",
    }
    async with httpx.AsyncClient(timeout=_TEST_TIMEOUT_S) as client:
        resp = await client.post(url, data=data)
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _test_sharepoint(config: dict) -> TestResult:
    import httpx

    token = await _get_graph_token(config)
    site_url = config["site_url"].rstrip("/")
    # Extract hostname and path from site_url
    from urllib.parse import urlparse

    parsed = urlparse(site_url)
    hostname = parsed.hostname
    site_path = parsed.path.rstrip("/")
    graph_url = f"https://graph.microsoft.com/v1.0/sites/{hostname}:{site_path}"
    async with httpx.AsyncClient(timeout=_TEST_TIMEOUT_S) as client:
        resp = await client.get(graph_url, headers={"Authorization": f"Bearer {token}"})
        resp.raise_for_status()
        site_name = resp.json().get("displayName", site_url)
    return TestResult(True, f"Connected to SharePoint site '{site_name}'")


async def _test_onedrive(config: dict) -> TestResult:
    import httpx

    token = await _get_graph_token(config)
    drive_id = config.get("drive_id")
    if drive_id:
        url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}"
    else:
        url = "https://graph.microsoft.com/v1.0/drive"
    async with httpx.AsyncClient(timeout=_TEST_TIMEOUT_S) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        resp.raise_for_status()
        name = resp.json().get("name", "default")
    return TestResult(True, f"Connected to OneDrive '{name}'")


async def _test_onedrive_business(config: dict) -> TestResult:
    import httpx

    token = await _get_graph_token(config)
    email = config["user_email"]
    url = f"https://graph.microsoft.com/v1.0/users/{email}/drive"
    async with httpx.AsyncClient(timeout=_TEST_TIMEOUT_S) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
        resp.raise_for_status()
        name = resp.json().get("name", email)
    return TestResult(True, f"Connected to OneDrive for Business '{name}'")


# ---------------------------------------------------------------------------
# Logic Apps Connector — Azure Storage based
# ---------------------------------------------------------------------------


async def _test_azure_file_storage(config: dict) -> TestResult:
    from azure.storage.fileshare import ShareServiceClient

    client = ShareServiceClient.from_connection_string(config["connection_string"])
    share = client.get_share_client(config["share_name"])
    props = share.get_share_properties()
    return TestResult(True, f"Connected to file share '{props['name']}'")


async def _test_azure_queues(config: dict) -> TestResult:
    from azure.storage.queue import QueueServiceClient

    client = QueueServiceClient.from_connection_string(config["connection_string"])
    queue = client.get_queue_client(config["queue_name"])
    queue.get_queue_properties()
    return TestResult(True, f"Connected to queue '{config['queue_name']}'")


async def _test_service_bus(config: dict) -> TestResult:
    from azure.servicebus import ServiceBusClient

    client = ServiceBusClient.from_connection_string(config["connection_string"])
    queue_or_topic = config["queue_or_topic"]
    receiver = client.get_queue_receiver(queue_name=queue_or_topic, max_wait_time=5)
    # Just peek to verify access; close immediately
    receiver.close()
    client.close()
    return TestResult(True, f"Connected to Service Bus '{queue_or_topic}'")


# ---------------------------------------------------------------------------
# Extras-based (import check first)
# ---------------------------------------------------------------------------


async def _test_amazon_s3(config: dict) -> TestResult:
    try:
        import boto3  # noqa: F811
    except ImportError:
        return TestResult(False, "Amazon S3 requires extra dependencies: pip install '.[aws]'")
    client = boto3.client(
        "s3",
        aws_access_key_id=config["access_key_id"],
        aws_secret_access_key=config["secret_access_key"],
        region_name=config.get("region", "us-east-1"),
    )
    client.head_bucket(Bucket=config["bucket_name"])
    return TestResult(True, f"Connected to S3 bucket '{config['bucket_name']}'")


async def _test_dropbox(config: dict) -> TestResult:
    try:
        import dropbox  # noqa: F811
    except ImportError:
        return TestResult(False, "Dropbox requires extra dependencies: pip install '.[dropbox]'")
    dbx = dropbox.Dropbox(config["access_token"])
    account = dbx.users_get_current_account()
    return TestResult(True, f"Connected to Dropbox as '{account.name.display_name}'")


async def _test_sftp_ssh(config: dict) -> TestResult:
    try:
        import paramiko  # noqa: F811
    except ImportError:
        return TestResult(False, "SFTP requires extra dependencies: pip install '.[sftp]'")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {
        "hostname": config["host"],
        "port": int(config.get("port", 22)),
        "username": config["username"],
        "timeout": _TEST_TIMEOUT_S,
    }
    auth_method = config.get("auth_method", "password")
    if auth_method == "private_key" and config.get("private_key"):
        import io

        key_file = io.StringIO(config["private_key"])
        pkey = paramiko.RSAKey.from_private_key(key_file)
        connect_kwargs["pkey"] = pkey
    else:
        connect_kwargs["password"] = config.get("password", "")
    ssh.connect(**connect_kwargs)
    sftp = ssh.open_sftp()
    remote_path = config.get("remote_path", "/")
    sftp.listdir(remote_path)
    sftp.close()
    ssh.close()
    return TestResult(True, f"Connected to SFTP host '{config['host']}:{connect_kwargs['port']}'")


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

_TESTERS: dict[str, object] = {
    "local_upload": _test_local_upload,
    "azure_blob": _test_azure_blob,
    "azure_adls_gen2": _test_azure_adls_gen2,
    "azure_cosmos_db": _test_azure_cosmos_db,
    "azure_sql": _test_azure_sql,
    "azure_table": _test_azure_table,
    "microsoft_onelake": _test_microsoft_onelake,
    "sharepoint": _test_sharepoint,
    "onedrive": _test_onedrive,
    "onedrive_business": _test_onedrive_business,
    "azure_file_storage": _test_azure_file_storage,
    "azure_queues": _test_azure_queues,
    "service_bus": _test_service_bus,
    "amazon_s3": _test_amazon_s3,
    "dropbox": _test_dropbox,
    "sftp_ssh": _test_sftp_ssh,
}


async def run_connectivity_test(source_type: str, config: dict) -> TestResult:
    """Test connectivity for a data source."""
    tester = _TESTERS.get(source_type)
    if not tester:
        return TestResult(False, f"Unknown source type: {source_type}")
    try:
        result = await asyncio.wait_for(tester(config), timeout=_TEST_TIMEOUT_S)
        return result
    except TimeoutError:
        return TestResult(False, f"Connection timed out after {_TEST_TIMEOUT_S} seconds")
    except Exception as exc:
        return TestResult(False, f"Connection failed: {exc}")
