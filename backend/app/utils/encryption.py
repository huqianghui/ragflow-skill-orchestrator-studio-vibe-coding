from cryptography.fernet import Fernet

from app.config import get_settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = get_settings().secret_encryption_key
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_value(value: str) -> str:
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_value(token: str) -> str:
    return _get_fernet().decrypt(token.encode()).decode()


def encrypt_config(config: dict, secret_fields: list[str]) -> dict:
    """Encrypt secret fields in a config dict before storage."""
    encrypted = config.copy()
    for field in secret_fields:
        if field in encrypted and encrypted[field]:
            encrypted[field] = encrypt_value(encrypted[field])
    return encrypted


def decrypt_config(config: dict, secret_fields: list[str]) -> dict:
    """Decrypt secret fields in a config dict after retrieval."""
    decrypted = config.copy()
    for field in secret_fields:
        if field in decrypted and decrypted[field]:
            try:
                decrypted[field] = decrypt_value(decrypted[field])
            except Exception:
                pass  # Already decrypted or invalid; skip
    return decrypted
