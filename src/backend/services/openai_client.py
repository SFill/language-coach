"""Shared OpenAI client initialization."""

from backend.settings import get_settings

settings = get_settings()

from openai import OpenAI  # noqa: E402

client = OpenAI(
    api_key=settings.openai_api_key.get_secret_value(),
    base_url=settings.openai_base_url,
)

DEFAULT_MODEL = settings.openai_model