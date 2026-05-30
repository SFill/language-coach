#!/usr/bin/env python3
"""
explain_screenshot.py — Describe a screenshot using a vision model.

Sends an image to a vision-capable LLM and returns a text explanation.
Supports two modes:
  - brief:   short, high-level summary
  - detailed: thorough description of layout, colors, text, spacing, components

Uses the OpenAI client pointed at a custom endpoint (from env vars).

Usage:
  python scripts/explain_screenshot.py <image_path> [--mode brief|detailed] [--focus <aspect>] [--model <model>]

Environment (loaded from .env in project root):
  OPENAI_API_KEY   — API key
  OPENAI_BASE_URL  — custom endpoint base URL (e.g. https://ollama.com/v1)
  OPENAI_MODEL     — model name (default: gpt-4o)
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

from dotenv import dotenv_values
from openai import OpenAI

# ── Load .env from project root ──────────────────────────────────────────────

_project_root = Path(__file__).resolve().parent.parent
_env_file = _project_root / ".env"
_env_vars = dotenv_values(_env_file) if _env_file.exists() else {}

API_KEY = os.environ.get("OPENAI_API_KEY") or _env_vars.get("OPENAI_API_KEY", "")
BASE_URL = os.environ.get("OPENAI_BASE_URL") or _env_vars.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL = os.environ.get("OPENAI_MODEL") or _env_vars.get("OPENAI_MODEL", "gpt-4o")

# ── Mode prompts ─────────────────────────────────────────────────────────────

MODE_PROMPTS = {
    "brief": (
        "Describe this screenshot briefly. Cover only the essential: "
        "what the page shows, main sections, and overall purpose. "
        "Keep it to 3-5 sentences. "
        "Pay attention to overlapping elements: "
        "like on image-titled cards with text, text is truncated or not visible at all."
    ),
    "detailed": (
        "Describe this screenshot in detail. Cover: "
        "1) Overall layout and structure (header, sidebar, main content, footer) "
        "2) Colors and theme (background, accent colors, text colors) "
        "3) Typography (font sizes, weights, headings vs body) "
        "4) UI components (buttons, cards, inputs, navigation) and their states "
        "5) Spacing and alignment (margins, padding, gaps) "
        "6) Text content visible on screen "
        "7) Any issues or inconsistencies you notice. "
        "Be specific — mention pixel-level details where relevant. "
        "Pay attention to overlapping elements: "
        "like on image-titled cards with text, text is truncated or not visible at all."
    ),
}

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def image_to_data_url(file_path: str) -> str:
    """Read an image file and return a data-URL string."""
    ext = Path(file_path).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        print(f"Error: unsupported image format '{ext}'. Supported: {sorted(SUPPORTED_EXTENSIONS)}", file=sys.stderr)
        sys.exit(1)

    mime = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }[ext]

    with open(file_path, "rb") as f:
        b64 = base64.standard_b64encode(f.read()).decode("ascii")

    return f"data:{mime};base64,{b64}"


def explain(image_path: str, mode: str, model: str, focus: str = "") -> str:
    """Send image to vision model and return explanation text."""
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    data_url = image_to_data_url(image_path)
    system_prompt = MODE_PROMPTS[mode]
    if focus:
        system_prompt += f"\n\nIMPORTANT — you MUST emphasize this aspect in your description: {focus}"

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                ],
            },
        ],
        max_tokens=2000 if mode == "detailed" else 800,
    )

    return response.choices[0].message.content


def main():
    parser = argparse.ArgumentParser(
        description="Explain a screenshot using a vision model via OpenAI-compatible API.",
    )
    parser.add_argument("image", help="Path to the screenshot image file")
    parser.add_argument(
        "--mode",
        choices=["brief", "detailed"],
        default="brief",
        help="Explanation mode: brief (short summary) or detailed (thorough description). Default: brief",
    )
    parser.add_argument(
        "--model",
        default=None,
        help=f"Model name. Default: OPENAI_MODEL env or '{MODEL}'",
    )
    parser.add_argument(
        "--focus",
        default="",
        help="Aspect to emphasize in the description (e.g. 'spacing and alignment', 'color consistency', 'text readability')",
    )

    args = parser.parse_args()

    if not API_KEY:
        print("Error: OPENAI_API_KEY not set (env or .env file)", file=sys.stderr)
        sys.exit(1)

    if not Path(args.image).exists():
        print(f"Error: file not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    model = args.model or MODEL
    result = explain(args.image, args.mode, model, args.focus)
    print(result)


if __name__ == "__main__":
    main()