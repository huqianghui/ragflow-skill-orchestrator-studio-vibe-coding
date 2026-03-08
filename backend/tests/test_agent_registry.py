"""Tests for the agent registry — register, discover (DB-backed), get."""

from collections.abc import AsyncGenerator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.base import Base
from app.services.agents.base import (
    AgentEvent,
    AgentMode,
    AgentRequest,
    BaseAgentAdapter,
)
from app.services.agents.registry import AgentRegistry

# In-memory SQLite for registry-specific tests
_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
_SessionLocal = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


class FakeAdapter(BaseAgentAdapter):
    name = "fake-agent"
    display_name = "Fake Agent"
    icon = "fake"
    description = "A fake adapter for testing"
    modes = [AgentMode.CODE]

    async def is_available(self) -> bool:
        return True

    async def get_version(self) -> str | None:
        return "1.0.0"

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        yield AgentEvent(type="text", content="hello")

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        return None


class BrokenAdapter(BaseAgentAdapter):
    name = "broken-agent"
    display_name = "Broken Agent"
    icon = "broken"
    description = "An adapter that fails during discovery"
    modes = [AgentMode.CODE]

    async def is_available(self) -> bool:
        raise RuntimeError("boom")

    async def get_version(self) -> str | None:
        return None

    async def execute(self, request: AgentRequest) -> AsyncGenerator[AgentEvent, None]:
        yield AgentEvent(type="error", content="fail")

    def extract_session_id(self, events: list[AgentEvent]) -> str | None:
        return None


@pytest.fixture(autouse=True)
async def _setup_registry_db():
    """Create and tear down tables for each test."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db():
    async with _SessionLocal() as session:
        yield session


@pytest.mark.asyncio
async def test_register_and_list_names():
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    assert "fake-agent" in reg.list_names()


@pytest.mark.asyncio
async def test_get_returns_adapter_instance():
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    adapter = reg.get("fake-agent")
    assert isinstance(adapter, FakeAdapter)


@pytest.mark.asyncio
async def test_get_unknown_raises():
    reg = AgentRegistry()
    with pytest.raises(ValueError, match="Unknown agent"):
        reg.get("nonexistent")


@pytest.mark.asyncio
async def test_discover_returns_info(db):
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    infos = await reg.discover(db)
    assert len(infos) == 1
    assert infos[0].name == "fake-agent"
    assert infos[0].available is True
    assert infos[0].version == "1.0.0"


@pytest.mark.asyncio
async def test_discover_isolates_broken_adapter(db):
    """A broken adapter should not prevent other adapters from being discovered."""
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    reg.register(BrokenAdapter)
    infos = await reg.discover(db)
    assert len(infos) == 2
    names = {i.name for i in infos}
    assert "fake-agent" in names
    assert "broken-agent" in names
    broken = next(i for i in infos if i.name == "broken-agent")
    assert broken.available is False


@pytest.mark.asyncio
async def test_discover_reads_from_db_on_second_call(db):
    """After refresh, discover should read from DB (not re-probe adapters)."""
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    # First call: DB empty → triggers refresh → probes adapter
    infos1 = await reg.discover(db)
    assert len(infos1) == 1

    # Invalidate in-memory cache to force DB read
    reg.invalidate_cache()

    # Second call: should read from DB without probing
    infos2 = await reg.discover(db)
    assert len(infos2) == 1
    assert infos2[0].name == "fake-agent"


@pytest.mark.asyncio
async def test_refresh_upserts(db):
    """Refresh should update existing rows, not duplicate them."""
    reg = AgentRegistry()
    reg.register(FakeAdapter)
    await reg.refresh(db)
    await reg.refresh(db)  # second call should update, not insert

    reg.invalidate_cache()
    infos = await reg.discover(db)
    assert len(infos) == 1


@pytest.mark.asyncio
async def test_global_registry_has_adapters():
    """The global registry should have adapters auto-registered on import."""
    from app.services.agents.registry import registry

    names = registry.list_names()
    assert "claude-code" in names
    assert "codex" in names
    assert "copilot" in names


@pytest.fixture(autouse=True, scope="module")
async def _dispose_registry_engine():
    yield
    await _engine.dispose()
