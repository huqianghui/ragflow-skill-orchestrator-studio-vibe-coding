from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.connection import Connection
from app.schemas.common import PaginatedResponse
from app.schemas.connection import (
    CONNECTION_TYPES,
    SECRET_FIELDS,
    ConnectionCreate,
    ConnectionResponse,
    ConnectionTestResult,
    ConnectionUpdate,
    mask_config,
)
from app.utils.encryption import decrypt_config, encrypt_config
from app.utils.exceptions import AppException, NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/connections", tags=["connections"])


def _to_response(conn: Connection) -> ConnectionResponse:
    """Convert a Connection model to response with masked secrets."""
    resp = ConnectionResponse.model_validate(conn)
    resp.config = mask_config(conn.config, conn.connection_type)
    return resp


@router.get("", response_model=PaginatedResponse[ConnectionResponse])
async def list_connections(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Connection.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Connection).order_by(Connection.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [_to_response(c) for c in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.get("/defaults")
async def get_default_connections(db: AsyncSession = Depends(get_db)):
    """Return the default connection for each connection_type (or null)."""
    result = await db.execute(select(Connection).where(Connection.is_default.is_(True)))
    defaults_by_type = {c.connection_type: _to_response(c) for c in result.scalars().all()}

    return {ct: defaults_by_type.get(ct) for ct in CONNECTION_TYPES}


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(body: ConnectionCreate, db: AsyncSession = Depends(get_db)):
    secret_fields = SECRET_FIELDS.get(body.connection_type, [])
    encrypted = encrypt_config(body.config, secret_fields)

    conn = Connection(
        name=body.name,
        connection_type=body.connection_type,
        description=body.description,
        config=encrypted,
        is_default=body.is_default,
    )

    # If setting as default, clear existing default for this type
    if body.is_default:
        existing = await db.execute(
            select(Connection).where(
                Connection.connection_type == body.connection_type,
                Connection.is_default.is_(True),
            )
        )
        for other in existing.scalars().all():
            other.is_default = False

    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return _to_response(conn)


@router.get("/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise NotFoundException("Connection", connection_id)
    return _to_response(conn)


@router.put("/{connection_id}", response_model=ConnectionResponse)
async def update_connection(
    connection_id: str,
    body: ConnectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise NotFoundException("Connection", connection_id)

    update_data = body.model_dump(exclude_unset=True)

    # If config is being updated, encrypt secret fields
    if "config" in update_data and update_data["config"] is not None:
        secret_fields = SECRET_FIELDS.get(conn.connection_type, [])
        update_data["config"] = encrypt_config(update_data["config"], secret_fields)

    # If setting as default, clear existing default for this type
    if update_data.get("is_default") is True:
        existing = await db.execute(
            select(Connection).where(
                Connection.connection_type == conn.connection_type,
                Connection.is_default.is_(True),
                Connection.id != conn.id,
            )
        )
        for other in existing.scalars().all():
            other.is_default = False

    for key, value in update_data.items():
        setattr(conn, key, value)

    await db.commit()
    await db.refresh(conn)
    return _to_response(conn)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise NotFoundException("Connection", connection_id)

    await db.delete(conn)
    await db.commit()


@router.post("/{connection_id}/test", response_model=ConnectionTestResult)
async def test_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise NotFoundException("Connection", connection_id)

    secret_fields = SECRET_FIELDS.get(conn.connection_type, [])
    config = decrypt_config(conn.config, secret_fields)

    try:
        await _test_connection_by_type(conn.connection_type, config)
        return ConnectionTestResult(success=True, message="Connection successful")
    except Exception as e:
        return ConnectionTestResult(success=False, message=str(e))


async def _test_connection_by_type(connection_type: str, config: dict) -> None:
    """Test connectivity for each connection type."""
    match connection_type:
        case "azure_openai":
            from openai import AzureOpenAI

            client = AzureOpenAI(
                azure_endpoint=config["endpoint"],
                api_key=config["api_key"],
                api_version=config.get("api_version", "2024-02-01"),
            )
            client.models.list()

        case "openai":
            from openai import OpenAI

            client = OpenAI(api_key=config["api_key"])
            client.models.list()

        case "azure_doc_intelligence":
            import httpx

            resp = httpx.get(
                f"{config['endpoint'].rstrip('/')}/formrecognizer/info",
                headers={"Ocp-Apim-Subscription-Key": config["api_key"]},
                params={"api-version": "2024-11-30"},
                timeout=10,
            )
            resp.raise_for_status()

        case "azure_content_understanding":
            import httpx

            resp = httpx.get(
                f"{config['endpoint'].rstrip('/')}/contentunderstanding/info",
                headers={"Ocp-Apim-Subscription-Key": config["api_key"]},
                params={"api-version": "2024-12-01-preview"},
                timeout=10,
            )
            resp.raise_for_status()

        case "azure_ai_foundry":
            import httpx

            resp = httpx.get(
                f"{config['endpoint'].rstrip('/')}/",
                headers={
                    "Ocp-Apim-Subscription-Key": config["api_key"],
                    "api-key": config["api_key"],
                },
                timeout=10,
            )
            resp.raise_for_status()

        case "http_api":
            import httpx

            headers = config.get("headers", {})
            auth_type = config.get("auth_type", "none")
            if auth_type == "bearer":
                headers["Authorization"] = f"Bearer {config.get('auth_value', '')}"
            elif auth_type == "api_key":
                headers["X-API-Key"] = config.get("auth_value", "")

            resp = httpx.get(config["base_url"], headers=headers, timeout=10)
            resp.raise_for_status()

        case _:
            raise AppException(
                status_code=400,
                code="VALIDATION_ERROR",
                message=f"Unknown connection type: {connection_type}",
            )


@router.put("/{connection_id}/set-default", response_model=ConnectionResponse)
async def set_default_connection(connection_id: str, db: AsyncSession = Depends(get_db)):
    """Toggle a connection as the default for its connection_type.

    If the connection is already the default, unset it.
    Otherwise, set it as default and clear any existing default for the same type.
    """
    result = await db.execute(select(Connection).where(Connection.id == connection_id))
    conn = result.scalar_one_or_none()
    if not conn:
        raise NotFoundException("Connection", connection_id)

    if conn.is_default:
        # Already default → unset
        conn.is_default = False
    else:
        # Clear existing default for this type
        existing = await db.execute(
            select(Connection).where(
                Connection.connection_type == conn.connection_type,
                Connection.is_default.is_(True),
            )
        )
        for other in existing.scalars().all():
            other.is_default = False
        conn.is_default = True

    await db.commit()
    await db.refresh(conn)
    return _to_response(conn)
