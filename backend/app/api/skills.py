from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.skill import Skill
from app.schemas.common import PaginatedResponse
from app.schemas.skill import SkillCreate, SkillResponse, SkillUpdate
from app.utils.exceptions import AppException, NotFoundException
from app.utils.pagination import paginate, pagination_params

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=PaginatedResponse[SkillResponse])
async def list_skills(
    params: dict = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    page, page_size = params["page"], params["page_size"]
    offset = (page - 1) * page_size

    total_result = await db.execute(select(func.count(Skill.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Skill).order_by(Skill.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [SkillResponse.model_validate(s) for s in result.scalars().all()]
    return paginate(items, total, page, page_size)


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(body: SkillCreate, db: AsyncSession = Depends(get_db)):
    skill = Skill(**body.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return SkillResponse.model_validate(skill)


@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)
    return SkillResponse.model_validate(skill)


@router.put("/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: str, body: SkillUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    if skill.is_builtin:
        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="Built-in skills cannot be modified",
        )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(skill, key, value)

    await db.commit()
    await db.refresh(skill)
    return SkillResponse.model_validate(skill)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    await db.delete(skill)
    await db.commit()
