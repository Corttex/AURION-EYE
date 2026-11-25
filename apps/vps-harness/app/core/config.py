from functools import lru_cache
from pathlib import Path
from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    aurion_token: str = "aurion-dev-secret-token-2026"
    fernet_master_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./aurion_vps.db"
    redis_url: str = "redis://localhost:6379/0"
    claude_daily_cap: int = 15
    master_key_file: str = ".aurion_master.key"

    def resolve_fernet_key(self) -> bytes:
        if self.fernet_master_key.strip():
            return self.fernet_master_key.strip().encode("utf-8")
        key_path = Path(self.master_key_file)
        if key_path.exists():
            return key_path.read_bytes().strip()
        generated = Fernet.generate_key()
        key_path.write_bytes(generated)
        return generated


@lru_cache
def get_settings() -> Settings:
    return Settings()
