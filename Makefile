.PHONY: up down reset logs db shell dev \
	woo-up woo-down woo-bootstrap woo-credentials woo-reset \
	prod-push prod-release prod-bootstrap-vps prod-init prod-secrets prod-deploy prod-ssl prod-migrate prod-migrate-status \
	prod-create-sysadmin prod-health prod-backup prod-logs prod-renew-certs

# =============================================================================
# Development — infra local (postgres, pgadmin, Next.js)
# =============================================================================

# Start Colima and core dev services (postgres + pgadmin only)
up:
	colima start --cpu 2 --memory 4 2>/dev/null || true
	docker compose up -d
	@echo "PostgreSQL → localhost:${POSTGRES_PORT:-5433}"
	@echo "pgAdmin   → http://localhost:${PGADMIN_PORT:-5050}"

# Stop all running compose services (keeps volumes)
down:
	docker compose down

# Reset core dev data only (postgres + pgadmin; Woo volumes untouched)
reset:
	docker compose down
	docker volume rm andiko_postgres_data andiko_pgadmin_data 2>/dev/null || true
	docker compose up -d
	@echo "PostgreSQL → localhost:${POSTGRES_PORT:-5433}"
	@echo "pgAdmin   → http://localhost:${PGADMIN_PORT:-5050}"

# Follow logs for all running services
logs:
	docker compose logs -f

# Follow logs for postgres only
db:
	docker compose logs -f postgres

# Open psql shell inside the container
shell:
	docker compose exec postgres psql -U $${POSTGRES_USER:-andiko} -d $${POSTGRES_DB:-andiko_dev}

# Start Next.js dev server (core infra must be up first)
dev: up
	pnpm dev

# =============================================================================
# Development — WooCommerce (optional; integration tests only)
# See docs/dev/woocommerce-local.md
# =============================================================================

# Start Woo stack + bootstrap (REST API keys → infra/docker/woocommerce/dev-output/credentials.env)
woo-up: woo-bootstrap

woo-bootstrap:
	mkdir -p infra/docker/woocommerce/dev-output
	chmod 777 infra/docker/woocommerce/dev-output
	docker compose --profile woo up -d woo-db wordpress
	docker compose --profile woo --profile woo-init run --rm woo-init
	@echo "WooCommerce → http://localhost:${WOO_PORT:-8080}  (make woo-credentials)"

# Stop Woo services (keeps Woo volumes)
woo-down:
	docker compose --profile woo stop wordpress woo-db

woo-credentials:
	@test -f infra/docker/woocommerce/dev-output/credentials.env || (echo "Missing credentials. Run: make woo-up" && exit 1)
	@cat infra/docker/woocommerce/dev-output/credentials.env

# Delete Woo volumes and stop Woo services
woo-reset:
	docker compose --profile woo down
	docker volume rm andiko_woo_wp_data andiko_woo_db_data 2>/dev/null || true
	@echo "Woo volumes removed. Run: make woo-up"

# =============================================================================
# Production (VPS / laptop) — see docs/deployment/production.md
# =============================================================================

prod-push:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-push TAG=v0.26.0" && exit 1)
	TAG=$(TAG) bash infra/scripts/push-image.sh

prod-release:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-release TAG=v0.26.0" && exit 1)
	TAG=$(TAG) SKIP_PULL=$(SKIP_PULL) SKIP_PUSH=$(SKIP_PUSH) SKIP_MIGRATE=$(SKIP_MIGRATE) \
		RELEASE_BRANCH=$(RELEASE_BRANCH) RELEASE_WAIT_SECONDS=$(RELEASE_WAIT_SECONDS) \
		bash infra/scripts/release.sh

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

prod-create-sysadmin:
	@test -n "$(TAG)" || (echo "TAG is required: make prod-create-sysadmin TAG=v0.26.0 EMAIL=... PASSWORD=..." && exit 1)
	@test -n "$(EMAIL)" || (echo "EMAIL is required: make prod-create-sysadmin TAG=... EMAIL=admin@andiko.cloud PASSWORD=..." && exit 1)
	@test -n "$(PASSWORD)" || (echo "PASSWORD is required (min 16 chars)" && exit 1)
	TAG=$(TAG) EMAIL=$(EMAIL) PASSWORD=$(PASSWORD) NAME="$(NAME)" bash infra/scripts/create-sysadmin.sh

prod-health:
	@curl -sf "$${HEALTH_URL:-https://andiko.cloud/api/health}" | cat
	@echo ""

prod-backup:
	bash infra/scripts/backup-db.sh

prod-logs:
	docker service logs -f andiko_app

prod-renew-certs:
	bash infra/certbot/renew.sh
