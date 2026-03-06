import asyncio
import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.connection import Connection
from app.models.skill import Skill
from app.schemas.common import PaginatedResponse
from app.schemas.skill import SkillCreate, SkillResponse, SkillUpdate
from app.services.skill_context import SkillContext
from app.services.skill_runner import SkillRunner
from app.services.venv_manager import VenvManager
from app.utils.exceptions import (
    AppException,
    ConflictException,
    NotFoundException,
    ValidationException,
)
from app.utils.pagination import paginate, pagination_params

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skills"])

PRELOADED_IMPORTS = {
    "standard_library": [
        "import re",
        "import json",
        "import math",
        "import csv",
        "import io",
        "import base64",
        "import hashlib",
        "import urllib.parse",
        "import logging",
        "from datetime import datetime, timedelta, timezone",
        "from typing import Dict, Any, Optional, List, Tuple",
        "from collections import Counter, defaultdict, OrderedDict",
    ],
    "third_party": [
        "import requests",
        "import httpx",
        "from pydantic import BaseModel",
        "from openai import OpenAI, AzureOpenAI",
        "from azure.identity import DefaultAzureCredential",
        "from azure.ai.documentintelligence import DocumentIntelligenceClient",
        "from azure.ai.contentsafety import ContentSafetyClient",
        "from azure.ai.projects import AIProjectClient",
        "from azure.ai.inference import ChatCompletionsClient",
    ],
}


@router.get("/preloaded-imports")
async def get_preloaded_imports():
    return PRELOADED_IMPORTS


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
    existing = await db.execute(select(Skill).where(Skill.name == body.name))
    if existing.scalar_one_or_none():
        raise ConflictException(f"Skill with name '{body.name}' already exists")

    skill = Skill(**body.model_dump())
    db.add(skill)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ConflictException(f"Skill with name '{body.name}' already exists")
    await db.refresh(skill)
    _ensure_skill_venv(skill)
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

    old_reqs = skill.additional_requirements
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(skill, key, value)

    await db.commit()
    await db.refresh(skill)
    # Rebuild venv if requirements changed
    if skill.additional_requirements != old_reqs:
        _cleanup_and_rebuild_venv(skill)
    return SkillResponse.model_validate(skill)


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    skill_id_to_clean = skill.id
    await db.delete(skill)
    await db.commit()
    _cleanup_venv(skill_id_to_clean)


def _ensure_skill_venv(skill: Skill) -> None:
    """Best-effort venv setup for python_code skills with additional requirements."""
    if skill.skill_type != "python_code" or not skill.additional_requirements:
        return
    try:
        VenvManager().ensure_skill_env(skill.id, skill.additional_requirements)
    except Exception:
        logger.warning("Failed to setup venv for skill %s", skill.id, exc_info=True)


def _cleanup_and_rebuild_venv(skill: Skill) -> None:
    """Cleanup old venv and rebuild if needed."""
    try:
        mgr = VenvManager()
        mgr.cleanup_skill_env(skill.id)
        if skill.additional_requirements:
            mgr.ensure_skill_env(skill.id, skill.additional_requirements)
    except Exception:
        logger.warning("Failed to rebuild venv for skill %s", skill.id, exc_info=True)


def _cleanup_venv(skill_id: str) -> None:
    """Cleanup venv on skill deletion."""
    try:
        VenvManager().cleanup_skill_env(skill_id)
    except Exception:
        logger.warning("Failed to cleanup venv for skill %s", skill_id, exc_info=True)


# --- Skill Test Execution ---


class SkillTestRequest(BaseModel):
    test_input: dict = Field(..., description="Azure AI Search custom skill format input")


class SkillTestCodeRequest(BaseModel):
    source_code: str
    connection_mappings: dict | None = None
    test_input: dict


async def _build_context(
    connection_mappings: dict | None,
    config: dict,
    db: AsyncSession,
) -> SkillContext:
    """Build a SkillContext from connection mappings."""
    connections: dict[str, dict] = {}
    if connection_mappings:
        for name, conn_id in connection_mappings.items():
            result = await db.execute(select(Connection).where(Connection.id == conn_id))
            conn = result.scalar_one_or_none()
            if not conn:
                raise ValidationException(f"Connection '{conn_id}' for mapping '{name}' not found")
            connections[name] = {
                "connection_type": conn.connection_type,
                "config": conn.config,
            }
    return SkillContext(config=config, connections=connections)


async def _run_with_timeout(runner: SkillRunner, source_code, test_input, context):
    timeout = get_settings().sync_execution_timeout_s
    try:
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, runner.execute, source_code, test_input, context
            ),
            timeout=timeout,
        )
    except TimeoutError:
        return {
            "values": [],
            "logs": context.logger.entries,
            "execution_time_ms": timeout * 1000,
            "error": f"Execution timed out after {timeout}s",
        }
    except (ValueError, SyntaxError) as e:
        raise ValidationException(str(e)) from e


@router.post("/{skill_id}/test")
async def test_skill(
    skill_id: str,
    body: SkillTestRequest,
    db: AsyncSession = Depends(get_db),
):
    """Test a saved python_code Skill with sample input."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    if skill.skill_type != "python_code":
        raise ValidationException("Only python_code skills can be tested")

    if not skill.source_code:
        raise ValidationException("Skill has no source code")

    context = await _build_context(skill.connection_mappings, skill.config_schema, db)
    runner = SkillRunner()
    return await _run_with_timeout(runner, skill.source_code, body.test_input, context)


@router.post("/test-code")
async def test_skill_code(
    body: SkillTestCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Test unsaved Python skill code with sample input."""
    context = await _build_context(body.connection_mappings, {}, db)
    runner = SkillRunner()
    return await _run_with_timeout(runner, body.source_code, body.test_input, context)
