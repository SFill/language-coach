run_in_container:
	docker run --rm -p 80:80 -v $$(pwd)/database.db:/app/database.db --env-file .env -v $$(pwd)/src/backend:/app/src/backend --name language_coach language_coach

build:
	docker build -t language_coach .

run_frontend:
	npx vite --host 0.0.0.0

run_backend:
	fastapi dev --host 0.0.0.0 src/backend/main.py
