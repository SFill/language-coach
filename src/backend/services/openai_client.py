"""Shared OpenAI client initialization."""

import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=os.environ.get("OPENAI_BASE_URL"),
)

DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")