from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.run import Run
from app.schemas.common import PaginatedResponse
from app.schemas.run import RunCreate, RunResponse
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=PaginatedResponse[RunResponse])
async def list_runs(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Run.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Run).order_by(Run.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [RunResponse.model_validate(r) for r in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
async def create_run(body: RunCreate, db: AsyncSession = Depends(get_db)):
    run = Run(**body.model_dump())
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return RunResponse.model_validate(run)


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise NotFoundException("Run", run_id)
    return RunResponse.model_validate(run)
