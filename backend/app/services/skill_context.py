from datetime import UTC, datetime
from typing import Any

from app.schemas.connection import SECRET_FIELDS
from app.utils.encryption import decrypt_config


class ContextLogger:
    """Collects log entries from user code, returned after execution."""

    def __init__(self):
        self.entries: list[dict] = []

    def info(self, message: str, **kwargs):
        self._log("INFO", message, kwargs)

    def warning(self, message: str, **kwargs):
        self._log("WARNING", message, kwargs)

    def error(self, message: str, **kwargs):
        self._log("ERROR", message, kwargs)

    def _log(self, level: str, message: str, details: dict):
        self.entries.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "level": level,
                "message": message,
                "details": details or None,
            }
        )


class ClientFactory:
    """Creates SDK clients from Connection config."""

    @staticmethod
    def create(connection_type: str, config: dict) -> Any:
        match connection_type:
            case "azure_openai":
                from openai import AzureOpenAI

                return AzureOpenAI(
                    azure_endpoint=config["endpoint"],
                    api_key=config["api_key"],
                    api_version=config.get("api_version", "2024-02-01"),
                )

            case "openai":
                from openai import OpenAI

                return OpenAI(api_key=config["api_key"])

            case "azure_doc_intelligence":
                import httpx

                return httpx.Client(
                    base_url=config["endpoint"].rstrip("/"),
                    headers={"Ocp-Apim-Subscription-Key": config["api_key"]},
                    timeout=httpx.Timeout(connect=10, read=180, write=120, pool=10),
                )

            case "azure_content_understanding":
                import httpx

                return httpx.Client(
                    base_url=config["endpoint"].rstrip("/"),
                    headers={"Ocp-Apim-Subscription-Key": config["api_key"]},
                    timeout=httpx.Timeout(connect=10, read=180, write=120, pool=10),
                )

            case "azure_ai_foundry":
                import httpx

                return httpx.Client(
                    base_url=config["endpoint"].rstrip("/"),
                    headers={
                        "Ocp-Apim-Subscription-Key": config["api_key"],
                        "api-key": config["api_key"],
                    },
                    timeout=60,
                )

            case "http_api":
                import httpx

                headers = config.get("headers", {})
                auth_type = config.get("auth_type", "none")
                if auth_type == "bearer":
                    headers["Authorization"] = f"Bearer {config.get('auth_value', '')}"
                elif auth_type == "api_key":
                    headers["X-API-Key"] = config.get("auth_value", "")

                return httpx.Client(
                    base_url=config["base_url"],
                    headers=headers,
                    timeout=60,
                )

            case _:
                raise ValueError(f"Unknown connection type: {connection_type}")


class SkillContext:
    """Runtime context accessible by user skill code."""

    def __init__(self, config: dict, connections: dict[str, dict]):
        """
        Args:
            config: Skill config_schema values
            connections: mapping of {name: {connection_type, config (encrypted)}}
        """
        self.config = config
        self._connections = connections
        self._clients: dict[str, Any] = {}
        self.logger = ContextLogger()

    def get_client(self, name: str) -> Any:
        """Get an authenticated SDK client by connection mapping name."""
        if name not in self._clients:
            if name not in self._connections:
                available = list(self._connections.keys())
                raise ValueError(f"Connection '{name}' not found. Available: {available}")
            conn_info = self._connections[name]
            secret_fields = SECRET_FIELDS.get(conn_info["connection_type"], [])
            decrypted = decrypt_config(conn_info["config"], secret_fields)
            self._clients[name] = ClientFactory.create(conn_info["connection_type"], decrypted)
        return self._clients[name]
