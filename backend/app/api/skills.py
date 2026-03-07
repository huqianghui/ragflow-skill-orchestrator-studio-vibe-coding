import asyncio
import logging

from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.connection import Connection
from app.models.skill import Skill
from app.schemas.common import PaginatedResponse
from app.schemas.skill import SkillConfigureRequest, SkillCreate, SkillResponse, SkillUpdate
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


@router.get("/test-file/{file_id}")
async def get_test_file(file_id: str):
    """Return an uploaded temp file for preview (e.g. PDF in iframe)."""
    import urllib.parse

    from app.services.temp_file_manager import resolve_temp_file

    file_info = resolve_temp_file(file_id)
    if not file_info:
        raise NotFoundException("TestFile", file_id)
    # Use RFC 5987 encoding for non-ASCII filenames
    encoded_name = urllib.parse.quote(file_info["filename"])
    return Response(
        content=file_info["content"],
        media_type=file_info["content_type"],
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}"},
    )


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


@router.put("/{skill_id}/configure", response_model=SkillResponse)
async def configure_builtin_skill(
    skill_id: str,
    body: SkillConfigureRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update runtime configuration for a built-in skill."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    if not skill.is_builtin:
        raise AppException(
            status_code=403,
            code="FORBIDDEN",
            message="Only built-in skills can be configured via this endpoint",
        )

    # Validate bound_connection_id type if provided
    if body.bound_connection_id is not None:
        conn_result = await db.execute(
            select(Connection).where(Connection.id == body.bound_connection_id)
        )
        conn = conn_result.scalar_one_or_none()
        if not conn:
            raise ValidationException(f"Connection '{body.bound_connection_id}' not found")
        if (
            skill.required_resource_types
            and conn.connection_type not in skill.required_resource_types
        ):
            raise ValidationException(
                f"Connection type '{conn.connection_type}' not compatible "
                f"with skill requirement {skill.required_resource_types}"
            )
        skill.bound_connection_id = body.bound_connection_id

    if body.config_values is not None:
        skill.config_values = body.config_values

    await db.commit()
    await db.refresh(skill)
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


# --- File Upload for Testing ---

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload-test-file")
async def upload_test_file(file: UploadFile):
    """Upload a temporary file for skill testing."""
    from app.services.temp_file_manager import save_temp_file

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise ValidationException(
            f"File too large ({len(content)} bytes). Max: {MAX_UPLOAD_SIZE} bytes"
        )

    info = save_temp_file(
        filename=file.filename or "upload",
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    return {
        "file_id": info["file_id"],
        "filename": info["filename"],
        "content_type": info["content_type"],
        "size": info["size"],
        "expires_at": info["expires_at"],
    }


# --- Skill Test Execution ---


class SkillTestRequest(BaseModel):
    test_input: dict = Field(..., description="Azure AI Search custom skill format input")
    config_override: dict | None = Field(
        default=None, description="Override config_values for this test run only"
    )


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
    """Test a saved Skill (python_code or builtin) with sample input."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise NotFoundException("Skill", skill_id)

    if skill.skill_type == "builtin":
        return await _test_builtin_skill(skill, body, db)

    if skill.skill_type != "python_code":
        raise ValidationException("Only python_code and builtin skills can be tested")

    if not skill.source_code:
        raise ValidationException("Skill has no source code")

    context = await _build_context(skill.connection_mappings, skill.config_schema, db)
    runner = SkillRunner()
    return await _run_with_timeout(runner, skill.source_code, body.test_input, context)


async def _test_builtin_skill(skill: Skill, body: SkillTestRequest, db: AsyncSession):
    """Test a built-in skill using BuiltinSkillRunner."""
    from app.services.builtin_skills.runner import BuiltinSkillRunner

    # Resolve config: saved config_values, overridden by config_override
    config = dict(skill.config_values or {})
    if body.config_override:
        config.update(body.config_override)

    # Resolve connection client
    client = None
    if skill.required_resource_types:
        conn_id = skill.bound_connection_id

        # Fallback to default connection if none bound
        if not conn_id:
            target_type = skill.required_resource_types[0]
            conn_result = await db.execute(
                select(Connection).where(
                    Connection.connection_type == target_type,
                    Connection.is_default.is_(True),
                )
            )
            default_conn = conn_result.scalar_one_or_none()
            if default_conn:
                conn_id = default_conn.id

        if not conn_id:
            raise ValidationException(
                f"No connection bound and no default connection "
                f"for type '{skill.required_resource_types[0]}'"
            )

        conn_result = await db.execute(select(Connection).where(Connection.id == conn_id))
        conn = conn_result.scalar_one_or_none()
        if not conn:
            raise ValidationException(f"Bound connection '{conn_id}' not found")

        from app.schemas.connection import SECRET_FIELDS
        from app.services.skill_context import ClientFactory
        from app.utils.encryption import decrypt_config

        secret_fields = SECRET_FIELDS.get(conn.connection_type, [])
        decrypted = decrypt_config(conn.config, secret_fields)
        client = ClientFactory.create(conn.connection_type, decrypted)

    # Resolve file_id in test_input if present
    test_input = _resolve_file_ids(body.test_input)

    # Inject _connection_type into each record's data so skills can dispatch
    if conn_id:
        conn_type = conn.connection_type if conn else None
        if conn_type:
            for record in test_input.get("values", []):
                record.setdefault("data", {})["_connection_type"] = conn_type

    runner = BuiltinSkillRunner()
    timeout = get_settings().sync_execution_timeout_s
    try:
        return await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None, runner.execute, skill.name, test_input, config, client
            ),
            timeout=timeout,
        )
    except TimeoutError:
        return {
            "values": [],
            "logs": [],
            "execution_time_ms": timeout * 1000,
            "error": f"Execution timed out after {timeout}s",
        }


def _resolve_file_ids(test_input: dict) -> dict:
    """Resolve file_id references in test_input to actual file content."""
    from app.services.temp_file_manager import resolve_temp_file

    values = test_input.get("values", [])
    for record in values:
        data = record.get("data", {})
        if "file_id" in data:
            file_info = resolve_temp_file(data["file_id"])
            if file_info:
                data["file_content"] = file_info["content"]
                data["file_name"] = file_info["filename"]
    return test_input


@router.post("/test-code")
async def test_skill_code(
    body: SkillTestCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Test unsaved Python skill code with sample input."""
    context = await _build_context(body.connection_mappings, {}, db)
    runner = SkillRunner()
    return await _run_with_timeout(runner, body.source_code, body.test_input, context)
