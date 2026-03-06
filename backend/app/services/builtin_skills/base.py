"""Base class for all built-in skill implementations."""

from abc import ABC, abstractmethod
from typing import Any


class BaseBuiltinSkill(ABC):
    """Base class for built-in skill implementations."""

    @abstractmethod
    def execute(self, data: dict, config: dict, client: Any | None) -> dict:
        """
        Execute the skill on a single record.

        Args:
            data: Input record data
            config: User-configured parameters (from config_values)
            client: Authenticated SDK client (from bound Connection), None for local skills
        Returns:
            dict with processed results
        """
        ...
