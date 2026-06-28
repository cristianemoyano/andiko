.PHONY: up down reset logs db shell dev \
	prod-push prod-bootstrap-vps prod-init prod-secrets prod-deploy prod-ssl prod-migrate prod-migrate-status \
	prod-health prod-backup prod-logs prod-renew-certs

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

# --- Production (VPS / laptop) — see docs/deployment/production.md ---

prod-push:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-push TAG=v0.26.0" && exit 1)
	TAG=$(TAG) bash infra/scripts/push-image.sh

prod-bootstrap-vps:
	sudo bash infra/scripts/bootstrap-vps.sh

prod-init:
	bash infra/scripts/init-swarm.sh

prod-secrets:
	bash infra/scripts/rotate-secrets.sh

prod-deploy:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-deploy TAG=v0.26.0" && exit 1)
	TAG=$(TAG) bash infra/scripts/deploy.sh

prod-ssl:
	bash infra/scripts/init-ssl.sh

prod-migrate:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-migrate TAG=v0.26.0" && exit 1)
	TAG=$(TAG) bash infra/scripts/migrate.sh up

prod-migrate-status:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-migrate-status TAG=v0.26.0" && exit 1)
	TAG=$(TAG) bash infra/scripts/migrate.sh status

prod-health:
	@curl -sf "$${HEALTH_URL:-https://andiko.cloud/api/health}" | cat
	@echo ""

prod-backup:
	bash infra/scripts/backup-db.sh

prod-logs:
	docker service logs -f andiko_app

prod-renew-certs:
	bash infra/certbot/renew.sh
