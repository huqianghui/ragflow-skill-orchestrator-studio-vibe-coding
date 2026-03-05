import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.builtin_skills import BUILTIN_SKILLS
from app.models.skill import Skill
from app.services.skill_seeder import seed_builtin_skills

from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_first_seed_inserts_all_skills():
    async with TestSessionLocal() as db:
        await seed_builtin_skills(db)

        result = await db.execute(select(Skill).where(Skill.is_builtin.is_(True)))
        skills = result.scalars().all()
        assert len(skills) == len(BUILTIN_SKILLS)

        names = {s.name for s in skills}
        expected = {s["name"] for s in BUILTIN_SKILLS}
        assert names == expected


@pytest.mark.asyncio
async def test_repeated_seed_no_duplicates():
    async with TestSessionLocal() as db:
        await seed_builtin_skills(db)
        await seed_builtin_skills(db)

        result = await db.execute(select(Skill).where(Skill.is_builtin.is_(True)))
        skills = result.scalars().all()
        assert len(skills) == len(BUILTIN_SKILLS)


@pytest.mark.asyncio
async def test_partial_seed_fills_missing():
    async with TestSessionLocal() as db:
        # Insert only the first skill manually
        first = BUILTIN_SKILLS[0]
        db.add(Skill(**first))
        await db.commit()

        # Seed should insert the remaining ones
        await seed_builtin_skills(db)

        result = await db.execute(select(Skill).where(Skill.is_builtin.is_(True)))
        skills = result.scalars().all()
        assert len(skills) == len(BUILTIN_SKILLS)
