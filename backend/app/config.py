from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RAGFlow Skill Orchestrator Studio"
    version: str = "0.1.0"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:15173"]
    max_upload_size_mb: int = 100
    sync_execution_timeout_s: int = 300
    cleanup_retention_days: int = 7
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()
