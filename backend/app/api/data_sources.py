from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.data_source import DataSource
from app.schemas.common import PaginatedResponse
from app.schemas.data_source import DataSourceCreate, DataSourceResponse, DataSourceUpdate
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/data-sources", tags=["data-sources"])


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
    items = [DataSourceResponse.model_validate(ds) for ds in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=DataSourceResponse, status_code=status.HTTP_201_CREATED)
async def create_data_source(body: DataSourceCreate, db: AsyncSession = Depends(get_db)):
    ds = DataSource(**body.model_dump())
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    return DataSourceResponse.model_validate(ds)


@router.get("/{ds_id}", response_model=DataSourceResponse)
async def get_data_source(ds_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)
    return DataSourceResponse.model_validate(ds)


@router.put("/{ds_id}", response_model=DataSourceResponse)
async def update_data_source(
    ds_id: str, body: DataSourceUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ds, key, value)

    await db.commit()
    await db.refresh(ds)
    return DataSourceResponse.model_validate(ds)


@router.delete("/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data_source(ds_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
    ds = result.scalar_one_or_none()
    if not ds:
        raise NotFoundException("DataSource", ds_id)

    await db.delete(ds)
    await db.commit()
