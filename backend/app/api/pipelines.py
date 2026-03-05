from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.pipeline import Pipeline
from app.schemas.common import PaginatedResponse
from app.schemas.pipeline import PipelineCreate, PipelineResponse, PipelineUpdate
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.get("", response_model=PaginatedResponse[PipelineResponse])
async def list_pipelines(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Pipeline.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Pipeline).order_by(Pipeline.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [PipelineResponse.model_validate(p) for p in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
async def create_pipeline(body: PipelineCreate, db: AsyncSession = Depends(get_db)):
    pipeline = Pipeline(**body.model_dump())
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return PipelineResponse.model_validate(pipeline)


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)
    return PipelineResponse.model_validate(pipeline)


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str, body: PipelineUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pipeline, key, value)

    await db.commit()
    await db.refresh(pipeline)
    return PipelineResponse.model_validate(pipeline)


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise NotFoundException("Pipeline", pipeline_id)

    await db.delete(pipeline)
    await db.commit()
