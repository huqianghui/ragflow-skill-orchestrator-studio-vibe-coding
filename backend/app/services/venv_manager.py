import logging
import shutil
import subprocess
import sys
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)

PRELOADED_PACKAGES = [
    "requests",
    "httpx",
    "pydantic",
    "cryptography",
    "openai",
    "azure-identity",
    "azure-ai-documentintelligence",
    "azure-ai-contentsafety",
    "azure-ai-projects",
    "azure-ai-inference",
]


class VenvManager:
    """Manages virtual environments for skill execution."""

    def __init__(self):
        self.root = Path(get_settings().skill_venvs_root)

    @property
    def base_path(self) -> Path:
        return self.root / "_base"

    def skill_env_path(self, skill_id: str) -> Path:
        return self.root / f"skill_{skill_id}"

    def _pip_path(self, env_path: Path) -> str:
        return str(env_path / "bin" / "pip")

    def _python_path(self, env_path: Path) -> str:
        return str(env_path / "bin" / "python")

    def ensure_base_env(self) -> Path:
        """Create base virtual environment with preloaded packages if it doesn't exist."""
        if self.base_path.exists():
            logger.info("Base venv already exists at %s", self.base_path)
            return self.base_path

        logger.info("Creating base venv at %s", self.base_path)
        self.root.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [sys.executable, "-m", "venv", str(self.base_path)],
            check=True,
        )

        pip = self._pip_path(self.base_path)
        subprocess.run(
            [pip, "install", "--quiet"] + PRELOADED_PACKAGES,
            check=True,
        )
        logger.info("Base venv created with %d packages", len(PRELOADED_PACKAGES))
        return self.base_path

    def ensure_skill_env(self, skill_id: str, additional_requirements: str | None) -> Path:
        """Create or return the environment for a skill.

        If no additional requirements, returns the base env path.
        Otherwise creates a skill-specific venv inheriting from base.
        """
        if not additional_requirements or not additional_requirements.strip():
            return self.base_path

        env_path = self.skill_env_path(skill_id)
        reqs = [r.strip() for r in additional_requirements.strip().split("\n") if r.strip()]

        if not reqs:
            return self.base_path

        # Create venv with --system-site-packages to inherit base packages
        if not env_path.exists():
            logger.info("Creating skill venv at %s", env_path)
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "venv",
                    "--system-site-packages",
                    str(env_path),
                ],
                check=True,
            )

        pip = self._pip_path(env_path)
        subprocess.run(
            [pip, "install", "--quiet"] + reqs,
            check=True,
        )
        logger.info("Skill venv ready with additional packages: %s", reqs)
        return env_path

    def cleanup_skill_env(self, skill_id: str) -> None:
        """Remove a skill-specific virtual environment."""
        env_path = self.skill_env_path(skill_id)
        if env_path.exists():
            logger.info("Removing skill venv at %s", env_path)
            shutil.rmtree(env_path)
