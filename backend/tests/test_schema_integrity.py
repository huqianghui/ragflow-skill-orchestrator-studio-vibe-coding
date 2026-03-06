"""Tests to verify database schema matches SQLAlchemy model definitions.

These tests catch schema drift — e.g. when columns are added to models
but the DB file was not recreated, causing 'no such column' errors at runtime.
"""

import os
import tempfile

import pytest
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from alembic import command
from app.models import Base
from app.models.connection import Connection
from app.models.skill import Skill


def _get_model_columns(model_class) -> set[str]:
    """Get column names defined in a SQLAlchemy model."""
    mapper = inspect(model_class)
    return {col.key for col in mapper.columns}


@pytest.mark.asyncio
async def test_skills_table_has_all_model_columns(client):
    """Verify the skills table schema includes all columns from the Skill model."""
    from tests.conftest import engine

    expected = _get_model_columns(Skill)
    async with engine.connect() as conn:
        result = await conn.execute(text("PRAGMA table_info(skills)"))
        actual = {row[1] for row in result.fetchall()}
    missing = expected - actual
    extra = actual - expected
    assert expected == actual, f"Schema mismatch. Missing: {missing}, Extra: {extra}"


@pytest.mark.asyncio
async def test_connections_table_has_all_model_columns(client):
    """Verify the connections table schema includes all columns from the Connection model."""
    from tests.conftest import engine

    expected = _get_model_columns(Connection)
    async with engine.connect() as conn:
        result = await conn.execute(text("PRAGMA table_info(connections)"))
        actual = {row[1] for row in result.fetchall()}
    missing = expected - actual
    extra = actual - expected
    assert expected == actual, f"Schema mismatch. Missing: {missing}, Extra: {extra}"


@pytest.mark.asyncio
async def test_all_tables_created(client):
    """Verify that all model tables exist in the database."""
    from tests.conftest import engine

    expected_tables = {
        mapper.local_table.name
        for mapper in Base.registry.mappers
        if hasattr(mapper, "local_table")
    }
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        actual_tables = {row[0] for row in result.fetchall()}
    missing = expected_tables - actual_tables
    assert not missing, f"Tables missing from DB: {missing}"


def test_alembic_migration_matches_models():
    """Verify alembic migration creates schema matching model definitions.

    Runs 'alembic upgrade head' on a temp SQLite DB and compares
    the resulting columns against model definitions. Catches
    the case where models have new columns but migration is outdated.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        db_url = f"sqlite:///{db_path}"

        # Configure alembic to use temp DB
        alembic_cfg = Config("alembic.ini")
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)

        # Run migration
        command.upgrade(alembic_cfg, "head")

        # Check schema
        engine = create_engine(db_url)
        with engine.connect() as conn:
            # Check skills table
            result = conn.execute(text("PRAGMA table_info(skills)"))
            skill_cols = {row[1] for row in result.fetchall()}
            expected_skill_cols = _get_model_columns(Skill)
            missing = expected_skill_cols - skill_cols
            assert not missing, (
                f"Alembic migration missing skill columns: {missing}. Update the migration file."
            )

            # Check connections table
            result = conn.execute(text("PRAGMA table_info(connections)"))
            conn_cols = {row[1] for row in result.fetchall()}
            expected_conn_cols = _get_model_columns(Connection)
            missing = expected_conn_cols - conn_cols
            assert not missing, (
                f"Alembic migration missing connection columns: {missing}. "
                "Update the migration file."
            )

            # Check all tables exist
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = {row[0] for row in result.fetchall()}
            expected_tables = {
                mapper.local_table.name
                for mapper in Base.registry.mappers
                if hasattr(mapper, "local_table")
            }
            missing_tables = expected_tables - tables
            assert not missing_tables, (
                f"Alembic migration missing tables: {missing_tables}. Update the migration file."
            )
        engine.dispose()
