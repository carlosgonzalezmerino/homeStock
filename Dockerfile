# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency install
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Python deps
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# App source and migrations
COPY app/ ./app/
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Frontend static files
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Serve frontend from FastAPI
COPY docker/serve_static.py ./docker/serve_static.py

EXPOSE 8000

# Apply pending migrations before serving, so the schema always matches the code
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn docker.serve_static:app --host 0.0.0.0 --port 8100"]
