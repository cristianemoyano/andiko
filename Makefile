.PHONY: up down reset logs db shell dev

# Start Colima and all services
up:
	colima start --cpu 2 --memory 4 2>/dev/null || true
	docker compose up -d
	@echo "PostgreSQL → localhost:5432"
	@echo "pgAdmin   → http://localhost:5050"

# Stop all services (keeps volumes)
down:
	docker compose down

# Stop and delete all data (full reset)
reset:
	docker compose down -v
	docker compose up -d

# Follow logs for all services
logs:
	docker compose logs -f

# Follow logs for postgres only
db:
	docker compose logs -f postgres

# Open psql shell inside the container
shell:
	docker compose exec postgres psql -U $${POSTGRES_USER:-andiko} -d $${POSTGRES_DB:-andiko_dev}

# Start Next.js dev server (infra must be up first)
dev: up
	pnpm dev
