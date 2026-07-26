#!/usr/bin/env bash
# Start the language-coach dev environment in Zellij (backend + frontend + scratch shell).
#
#   make dev        # or: bash scripts/dev.sh
#
# Behaviour:
#   - if a 'language-coach' session is already running  → reattach to it
#   - if a 'language-coach' session exists but EXITED   → delete and recreate
#   - otherwise                                        → start a fresh session
#
# Quit the session with Ctrl-q; it keeps running detached. Reattach later
# with `make dev` (or `zellij attach language-coach`).

set -euo pipefail

SESSION="language-coach"
LAYOUT="zellij/language-coach.kdl"

# Run from the repo root so the layout's relative paths (src/backend/main.py) resolve.
cd "$(dirname "$0")/.."

# zellij must be on PATH.
if ! command -v zellij >/dev/null 2>&1; then
    echo "zellij not found on PATH. Install: https://zellij.dev" >&2
    exit 1
fi

existing="$(zellij ls 2>/dev/null | grep "^${SESSION} " || true)"

if echo "${existing}" | grep -q "EXITED"; then
    echo "▸ previous '${SESSION}' session exited — recreating"
    zellij delete-session "${SESSION}" 2>/dev/null || true
    zellij --new-session-with-layout "${LAYOUT}" --session "${SESSION}"
elif [ -n "${existing}" ]; then
    echo "▸ reattaching to '${SESSION}'"
    zellij attach "${SESSION}"
else
    echo "▸ starting new '${SESSION}' session"
    zellij --new-session-with-layout "${LAYOUT}" --session "${SESSION}"
fi