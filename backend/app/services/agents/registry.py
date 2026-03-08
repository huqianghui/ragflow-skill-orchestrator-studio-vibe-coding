"""Agent registry — register, discover (DB-backed), and retrieve agent adapters."""

import asyncio
import logging
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_config import AgentConfig
from app.services.agents.base import AgentInfo, AgentMode, BaseAgentAdapter

logger = logging.getLogger(__name__)

# In-memory cache TTL — short (5s) since the DB query is already fast
_CACHE_TTL = 5


class AgentRegistry:
    """Central registry for all agent adapters."""

    def __init__(self) -> None:
        self._adapters: dict[str, type[BaseAgentAdapter]] = {}
        self._cache: list[AgentInfo] | None = None
        self._cache_ts: float = 0

    def register(self, adapter_class: type[BaseAgentAdapter]) -> None:
        """Register an adapter class. Instantiates once to read its name."""
        instance = adapter_class()
        self._adapters[instance.name] = adapter_class
        self._cache = None

    async def discover(self, db: AsyncSession) -> list[AgentInfo]:
        """Read agent info from DB (millisecond-level).

        If the DB has no rows yet (first startup before seed completes),
        falls back to a synchronous refresh.
        """
        now = time.monotonic()
        if self._cache is not None and (now - self._cache_ts) < _CACHE_TTL:
            return self._cache

        rows = (await db.execute(select(AgentConfig))).scalars().all()
        if not rows:
            # DB empty — first run before background seed; do a sync refresh
            await self.refresh(db)
            rows = (await db.execute(select(AgentConfig))).scalars().all()

        result = [self._row_to_info(r) for r in rows]
        self._cache = result
        self._cache_ts = time.monotonic()
        return result

    async def refresh(self, db: AsyncSession) -> None:
        """Probe all registered adapters in parallel and upsert results to DB."""
        tasks = [self._discover_one(cls) for cls in self._adapters.values()]
        infos: list[AgentInfo] = await asyncio.gather(*tasks)

        for info in infos:
            existing = (
                await db.execute(select(AgentConfig).where(AgentConfig.name == info.name))
            ).scalar_one_or_none()

            if existing:
                existing.display_name = info.display_name
                existing.icon = info.icon
                existing.description = info.description
                existing.modes = [m.value for m in info.modes]
                existing.available = info.available
                existing.version = info.version
                existing.provider = info.provider
                existing.model = info.model
                existing.install_hint = info.install_hint
                existing.tools = info.tools
                existing.mcp_servers = info.mcp_servers
            else:
                db.add(
                    AgentConfig(
                        name=info.name,
                        display_name=info.display_name,
                        icon=info.icon,
                        description=info.description,
                        modes=[m.value for m in info.modes],
                        available=info.available,
                        version=info.version,
                        provider=info.provider,
                        model=info.model,
                        install_hint=info.install_hint,
                        tools=info.tools,
                        mcp_servers=info.mcp_servers,
                    )
                )

        await db.commit()
        # Clear in-memory cache so next discover() re-reads DB
        self._cache = None

    def invalidate_cache(self) -> None:
        """Force cache refresh on next discover() call."""
        self._cache = None

    def get(self, name: str) -> BaseAgentAdapter:
        """Get a new adapter instance by name. Raises ValueError if unknown."""
        if name not in self._adapters:
            raise ValueError(f"Unknown agent: {name}")
        return self._adapters[name]()

    def list_names(self) -> list[str]:
        return list(self._adapters.keys())

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_info(row: AgentConfig) -> AgentInfo:
        """Convert an ORM row to an AgentInfo dataclass."""
        modes_raw = row.modes if isinstance(row.modes, list) else []
        return AgentInfo(
            name=row.name,
            display_name=row.display_name,
            icon=row.icon,
            description=row.description,
            modes=[AgentMode(m) for m in modes_raw],
            available=row.available,
            version=row.version,
            provider=row.provider,
            model=row.model,
            install_hint=row.install_hint,
            tools=row.tools if isinstance(row.tools, list) else [],
            mcp_servers=(row.mcp_servers if isinstance(row.mcp_servers, list) else []),
        )

    @staticmethod
    async def _discover_one(cls: type[BaseAgentAdapter]) -> AgentInfo:
        """Discover a single adapter, isolating failures."""
        try:
            adapter = cls()
            return await adapter.get_info()
        except Exception:
            adapter = cls()
            logger.warning("Failed to discover agent %s", adapter.name, exc_info=True)
            return AgentInfo(
                name=adapter.name,
                display_name=adapter.display_name,
                icon=adapter.icon,
                description=adapter.description,
                modes=adapter.modes,
                available=False,
                version=None,
                provider=adapter.provider or None,
                model=adapter.model or None,
                install_hint=adapter.install_hint or None,
                tools=adapter.default_tools,
                mcp_servers=[],
            )


# Global singleton
registry = AgentRegistry()
