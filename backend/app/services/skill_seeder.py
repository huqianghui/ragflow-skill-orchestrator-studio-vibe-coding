"""Seed built-in skills into the database on application startup."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.builtin_skills import BUILTIN_SKILLS
from app.models.skill import Skill

logger = logging.getLogger(__name__)


_SYNC_FIELDS = ("description", "config_schema", "required_resource_types", "pipeline_io")


async def seed_builtin_skills(db: AsyncSession) -> None:
    """Insert or update built-in skills. Idempotent — safe to call on every startup.

    New skills are inserted; existing skills get their metadata fields synced
    so that code-level changes (e.g. new pipeline_io defaults) are reflected
    in the database without requiring a manual migration.
    """
    result = await db.execute(select(Skill).where(Skill.is_builtin.is_(True)))
    existing: dict[str, Skill] = {s.name: s for s in result.scalars().all()}

    inserted = 0
    updated = 0

    for skill_def in BUILTIN_SKILLS:
        name = skill_def["name"]
        if name not in existing:
            db.add(Skill(**skill_def))
            inserted += 1
        else:
            skill = existing[name]
            changed = False
            for field in _SYNC_FIELDS:
                new_val = skill_def.get(field)
                if getattr(skill, field) != new_val:
                    setattr(skill, field, new_val)
                    changed = True
            if changed:
                updated += 1

    if inserted or updated:
        await db.commit()

    logger.info(
        "Built-in skills: %d inserted, %d updated, %d total defined.",
        inserted,
        updated,
        len(BUILTIN_SKILLS),
    )
