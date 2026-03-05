from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.target import Target
from app.schemas.common import PaginatedResponse
from app.schemas.target import TargetCreate, TargetResponse, TargetUpdate
from app.utils.exceptions import NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("", response_model=PaginatedResponse[TargetResponse])
async def list_targets(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Target.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Target).order_by(Target.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [TargetResponse.model_validate(t) for t in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
async def create_target(body: TargetCreate, db: AsyncSession = Depends(get_db)):
    target = Target(**body.model_dump())
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return TargetResponse.model_validate(target)


@router.get("/{target_id}", response_model=TargetResponse)
async def get_target(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)
    return TargetResponse.model_validate(target)


@router.put("/{target_id}", response_model=TargetResponse)
async def update_target(target_id: str, body: TargetUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target, key, value)

    await db.commit()
    await db.refresh(target)
    return TargetResponse.model_validate(target)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_target(target_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Target).where(Target.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise NotFoundException("Target", target_id)

    await db.delete(target)
    await db.commit()
