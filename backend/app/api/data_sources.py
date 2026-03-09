import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.data_source import DataSource
from app.schemas.common import PaginatedResponse
from app.schemas.data_source import (
    SECRET_FIELDS,
    DataSourceCreate,
    DataSourceResponse,
    DataSourceTestResult,
    DataSourceUpdate,
    UploadQuotaInfo,
    mask_config,
)
from app.services.data_source_tester import run_connectivity_test
from app.services.upload_manager import UploadManager
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/data-sources", tags=["data-sources"])

_upload_mgr = UploadManager()


def _mask_response(ds: DataSource) -> DataSourceResponse:
    """Build a response with secrets masked."""
    resp = DataSourceResponse.model_validate(ds)
    resp.connection_config = mask_config(resp.connection_config, resp.source_type)
    return resp


def _preserve_secrets(new_config: dict, old_config: dict, source_type: str) -> dict:
    """Keep old secret values when the update sends masked placeholders."""
    secret_names = SECRET_FIELDS.get(source_type, [])
    merged = new_config.copy()
    for field in secret_names:
        val = merged.get(field, "")
        if not val or "****" in str(val):
            if field in old_config:
                merged[field] = old_config[field]
    return merged


# ── Static routes MUST come before /{ds_id} ──


@router.get("/upload-quota", response_model=UploadQuotaInfo)
async def get_upload_quota():
    return _upload_mgr.get_quota_info()


@router.post("/upload")
async def upload_file(
    data_source_id: str,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DataSource).where(DataSource.id == data_source_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", data_source_id)
    if ds.source_type != "local_upload":
        raise HTTPException(400, "File upload is only supported for local_upload sources")

    content = await file.read()
    filename = file.filename or "uploaded_file"

    try:
        saved_path = _upload_mgr.save_file(ds.id, filename, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    # Update stats
    file_count, total_size = _upload_mgr.get_ds_stats(ds.id)
    ds.file_count = file_count
    ds.total_size = total_size
    await db.commit()
    await db.refresh(ds)

    safe_filename = urllib.parse.quote(filename)
    return {
        "filename": filename,
        "size": len(content),
        "path": str(saved_path),
        "safe_filename": safe_filename,
    }


# ── Standard CRUD ──


@router.get("", response_model=PaginatedResponse[DataSourceResponse])
async def list_data_sources(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(DataSource.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(DataSource).order_by(DataSource.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [_mask_response(ds) for ds in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(body: DataSourceCreate, db: AsyncSession = Depends(get_db)):
    ds = DataSource(**body.model_dump())
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return _mask_response(ds)


@router.get("/{ds_id}/files")
async def list_data_source_files(ds_id: str, db: AsyncSession = Depends(get_db)):
    """List files available in a data source."""
    from app.services.data_source_reader import FileInfo, list_files

    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)

    files = await list_files(ds.source_type, ds.connection_config or {}, ds.id)
    return [FileInfo.model_validate(f) for f in files]


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(ds_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)
    return _mask_response(ds)


@router.put("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(
    ds_id: str,
    body: DataSourceUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)

    update_data = body.model_dump(exclude_unset=True)

    # Preserve secrets that were masked in the response
    if "connection_config" in update_data and update_data["connection_config"]:
        update_data["connection_config"] = _preserve_secrets(
            update_data["connection_config"],
            ds.connection_config or {},
            ds.source_type,
        )

    for key, value in update_data.items():
        setattr(ds, key, value)

    await db.commit()
    await db.refresh(ds)
    return _mask_response(ds)


@router.post("/{ds_id}/test", response_model=DataSourceTestResult)
async def test_data_source_endpoint(ds_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)
    test_result = await run_connectivity_test(ds.source_type, ds.connection_config or {})
    return DataSourceTestResult(success=test_result.success, message=test_result.message)


@router.delete("/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(ds_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)

    # Clean up uploaded files for local_upload sources
    if ds.source_type == "local_upload":
        _upload_mgr.delete_ds_files(ds.id)

    await db.delete(ds)
    await db.commit()
