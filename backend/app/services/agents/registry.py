"""Agent registry — register, discover, and retrieve agent adapters."""

import asyncio
import logging
import time

from app.services.agents.base import AgentInfo, BaseAgentAdapter

logger = logging.getLogger(__name__)

# Cache TTL in seconds — avoid repeated subprocess calls (which, version, mcp list)
_CACHE_TTL = 60


class AgentRegistry:
    """Central registry for all agent adapters."""

    def __init__(self) -> None:
        self._adapters: dict[str, type[BaseAgentAdapter]] = {}
        self._cache: list[AgentInfo] | None = None
        self._cache_ts: float = 0
        self._cache_lock = asyncio.Lock()

    def register(self, adapter_class: type[BaseAgentAdapter]) -> None:
        """Register an adapter class. Instantiates once to read its name."""
        instance = adapter_class()
        self._adapters[instance.name] = adapter_class
        # Invalidate cache when registry changes
        self._cache = None

    async def discover(self) -> list[AgentInfo]:
        """Return info for all registered agents (cached for _CACHE_TTL seconds).

        Each adapter is isolated: a single adapter failure does not
        affect the others.
        """
        async with self._cache_lock:
            now = time.monotonic()
            if self._cache is not None and (now - self._cache_ts) < _CACHE_TTL:
                return self._cache

            results: list[AgentInfo] = []
            # Run all adapters concurrently for faster discovery
            tasks = []
            for cls in self._adapters.values():
                tasks.append(self._discover_one(cls))
            results = await asyncio.gather(*tasks)

            self._cache = results
            self._cache_ts = now
            return results

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


# Global singleton
registry = AgentRegistry()
