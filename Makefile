.PHONY: dev backend frontend redis worker flower migrate seed test lint

# Run both backend and frontend
dev:
	@echo "Start backend and frontend in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"

# Backend
backend:
	cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000 --timeout-keep-alive 75

# Frontend
frontend:
	cd frontend && npm run dev

# Start Redis via Docker (separate terminal or background)
redis:
	docker-compose up -d redis

# Celery worker — handles video, poster image generation, and default tasks (separate terminal)
worker:
	cd backend && source .venv/bin/activate && celery -A app.celery_app worker --loglevel=info --concurrency=4 -Q video,poster,studio,celery

# Flower task monitor — http://localhost:5555
flower:
	cd backend && source .venv/bin/activate && celery -A app.celery_app flower --port=5555

# Database migrations
migrate:
	cd backend && source .venv/bin/activate && alembic upgrade head

migrate-new:
	cd backend && source .venv/bin/activate && alembic revision --autogenerate -m "$(msg)"

# Seed data
seed:
	cd backend && source .venv/bin/activate && python -m scripts.seed

# Testing
test:
	cd backend && source .venv/bin/activate && pytest -v
	cd frontend && npm run typecheck

test-backend:
	cd backend && source .venv/bin/activate && pytest -v

test-frontend:
	cd frontend && npm run typecheck

# Linting
lint:
	cd backend && source .venv/bin/activate && ruff check app/
	cd backend && source .venv/bin/activate && mypy app/
	cd frontend && npm run lint
