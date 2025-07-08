# Stage 1: Build the frontend assets using Node
FROM node:18-alpine as frontend-builder
WORKDIR /app

# Copy package.json, vite configuration, and necessary frontend files
COPY package*.json vite.config.js index.html /app/
COPY public/ /app/public/

# Install dependencies 
RUN npm install

# build the frontend
COPY src/frontend/ /app/src/frontend/
RUN npm run build

# Stage 2: Build the final image with FastAPI and the built static files
FROM python:3.11-slim
WORKDIR /app


# Install Python dependencies (adjust if you have a requirements.txt)
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Copy the backend code and any additional necessary files
COPY src/backend/ /app/src/backend/


# Copy the built static files from the frontend build stage
COPY --from=frontend-builder /app/dist /app/dist

# Expose the port that FastAPI will run on
EXPOSE 80

# Command to run your FastAPI application. Ensure your main.py mounts the static files.
# CMD ["uvicorn", "src.backend.main:app", "--host", "0.0.0.0", "--port", "80"]
CMD ["fastapi", "dev", "--host", "0.0.0.0" ,"src/backend/main.py",  "--port", "80"]
