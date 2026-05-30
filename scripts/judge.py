#!/usr/bin/env python3
"""
judge.py — Vision model comparison bridge (replaces judge.mjs).

Compares a target screenshot against an implementation screenshot
using a vision model API. Returns structured JSON feedback.

Usage:
  python scripts/judge.py --target <target.png> --impl <impl.png> [--model <model>]

Environment (loaded from .env in project root):
  OPENAI_API_KEY   — API key
  OPENAI_BASE_URL  — custom endpoint base URL (e.g. https://ollama.com/v1)
  OPENAI_MODEL     — model name (default: gpt-4o)

Output: JSON to stdout — { "match": bool, "feedback": str, "diff_areas": [str] }
Exit codes: 0 = match, 1 = error, 2 = non-match
"""

import argparse
import base64
import json
import os
import re
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
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL") or _env_vars.get("OPENAI_MODEL", "gpt-4o")

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

SYSTEM_PROMPT = """\
You are a UI reviewer. Compare two screenshots: TARGET (desired design) and \
IMPLEMENTATION (current build).

Pay attention to missing text areas:
like TARGET show image cards with text, on IMPLEMENTATION text is truncated or not visible at all


Return a JSON object with:
- "match": boolean — true if implementation closely matches the target
- "feedback": string — specific, actionable feedback on what to fix. \
Be precise about spacing, colors, fonts, layout.
- "diff_areas": string[] — list of areas that differ \
(e.g. "navbar padding", "button color", "font size")\
"""


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


def judge(target_path: str, impl_path: str, model: str) -> dict:
    """Send both images to vision model and return structured comparison."""
    client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

    target_url = image_to_data_url(target_path)
    impl_url = image_to_data_url(impl_path)

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "TARGET screenshot:"},
                    {"type": "image_url", "image_url": {"url": target_url}},
                    {"type": "text", "text": "IMPLEMENTATION screenshot:"},
                    {"type": "image_url", "image_url": {"url": impl_url}},
                ],
            },
        ],
        max_tokens=1500,
    )

    raw = response.choices[0].message.content
    # Try direct JSON parse first; fall back to extracting from markdown fences
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if match:
            return json.loads(match.group(1))
        # Last resort: find first { ... } block
        brace_match = re.search(r"\{[\s\S]*\}", raw)
        if brace_match:
            return json.loads(brace_match.group(0))
        print(f"Error: could not parse model response as JSON:\n{raw}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Compare two screenshots using a vision model and return structured feedback.",
    )
    parser.add_argument("--target", required=True, help="Path to the target (desired) screenshot")
    parser.add_argument("--impl", required=True, help="Path to the implementation (current) screenshot")
    parser.add_argument("--model", default=None, help=f"Model name. Default: OPENAI_MODEL env or '{DEFAULT_MODEL}'")

    args = parser.parse_args()

    if not API_KEY:
        print("Error: OPENAI_API_KEY not set (env or .env file)", file=sys.stderr)
        sys.exit(1)

    for label, path in [("target", args.target), ("impl", args.impl)]:
        if not Path(path).exists():
            print(f"Error: {label} file not found: {path}", file=sys.stderr)
            sys.exit(1)

    model = args.model or DEFAULT_MODEL

    try:
        result = judge(args.target, args.impl, model)
    except Exception as err:
        print(f"Judge failed: {err}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2))

    if not result.get("match", False):
        sys.exit(2)


if __name__ == "__main__":
    main()