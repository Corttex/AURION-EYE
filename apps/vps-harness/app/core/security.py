from cryptography.fernet import Fernet
from fastapi import Header, HTTPException, status

from app.core.config import get_settings


class VaultService:
    """AES-256 (Fernet AES-128-CBC + HMAC-SHA256 authenticated encryption) secret vault."""

    def __init__(self, master_key: bytes | None = None):
        key = master_key or get_settings().resolve_fernet_key()
        self._fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")

    @staticmethod
    def mask(plaintext: str) -> str:
        if len(plaintext) <= 6:
            return "••••••••"
        return f"{plaintext[:4]}••••••••{plaintext[-3:]}"


def verify_bearer_token(token: str | None) -> bool:
    expected = get_settings().aurion_token
    if not token:
        return False
    cleaned = token.replace("Bearer ", "").strip()
    return cleaned == expected


async def require_auth(authorization: str | None = Header(default=None)) -> str:
    if not verify_bearer_token(authorization):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token AURION inválido ou ausente",
        )
    return authorization or ""
