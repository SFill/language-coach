run_in_container:
	docker run --rm -p 80:80 -v $$(pwd)/database.db:/app/database.db --env-file .env -v $$(pwd)/src/backend:/app/src/backend --name language_coach language_coach

build:
	docker build -t language_coach .

run_frontend:
	npx vite --host 0.0.0.0

run_backend:
	fastapi dev --host 0.0.0.0 src/backend/main.py

test:
	OPENAI_API_KEY=test-key python -m pytest src/backend/tests/ -v

run_claude_dashboard:
	uvx sniffly init

# Start backend + frontend together in a Zellij session.
# Reattaches to an existing 'language-coach' session if one is running.
# Requires zellij on PATH (install: https://zellij.dev, or ~/.local/bin/zellij).
dev:
	bash scripts/dev.sh