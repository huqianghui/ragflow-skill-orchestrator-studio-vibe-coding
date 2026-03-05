"""Seed built-in skills into the database on application startup."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.builtin_skills import BUILTIN_SKILLS
from app.models.skill import Skill

logger = logging.getLogger(__name__)


async def seed_builtin_skills(db: AsyncSession) -> None:
    """Insert missing built-in skills. Idempotent — safe to call on every startup."""
    result = await db.execute(
        select(Skill.name).where(Skill.is_builtin.is_(True))
    )
    existing_names: set[str] = {row[0] for row in result.all()}

    to_insert = [
        Skill(**skill_def)
        for skill_def in BUILTIN_SKILLS
        if skill_def["name"] not in existing_names
    ]

    if not to_insert:
        logger.info("All %d built-in skills already present, nothing to seed.", len(BUILTIN_SKILLS))
        return

    db.add_all(to_insert)
    await db.commit()
    logger.info(
        "Seeded %d built-in skills (total defined: %d).",
        len(to_insert), len(BUILTIN_SKILLS),
    )
