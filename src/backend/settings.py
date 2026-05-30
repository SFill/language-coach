from pathlib import Path
from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    # Database
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "language_coach"
    postgres_user: str = "language_coach_user"
    postgres_password: SecretStr = SecretStr("language_coach_password")

    # OpenAI
    openai_api_key: SecretStr = SecretStr("")
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    # Application
    backend_env: str = "dev"
    vite_environment: str = "dev"

    # File uploads
    upload_dir: Path = Path("/tmp/note_images")

    @property
    def database_url(self) -> str:
        password = self.postgres_password.get_secret_value()
        return (
            f"postgresql://{self.postgres_user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def is_dev(self) -> bool:
        return self.backend_env == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()