#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"

echo "==> Andiko production init"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running." >&2
  exit 1
fi

if ! docker info 2>/dev/null | grep -q 'Swarm: active'; then
  echo "Initializing Docker Swarm ..."
  docker swarm init || true
fi

POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/var/lib/andiko/postgres}"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"
CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/andiko/backups}"
PORTAINER_DATA_DIR="${PORTAINER_DATA_DIR:-/var/lib/andiko/portainer}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/var/lib/andiko/nginx/conf.d}"
UMAMI_DATA_DIR="${UMAMI_DATA_DIR:-/var/lib/andiko/umami-db}"

for dir in "$POSTGRES_DATA_DIR" "$CERTBOT_CERTS_DIR" "$CERTBOT_WWW_DIR" "$BACKUP_LOCAL_DIR" "$PORTAINER_DATA_DIR" "$NGINX_CONF_DIR" "$UMAMI_DATA_DIR"; do
  if [ ! -d "$dir" ]; then
    echo "Creating $dir"
    sudo mkdir -p "$dir"
    sudo chmod 755 "$dir"
  fi
done

if ! docker info 2>/dev/null | grep -q 'ghcr.io'; then
  if ! grep -q 'ghcr.io' "${HOME}/.docker/config.json" 2>/dev/null; then
    echo "Warning: not logged in to ghcr.io. Run:"
    echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin"
  fi
fi

create_or_update_secret() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "Missing value for secret ${name}" >&2
    exit 1
  fi
  if docker secret inspect "$name" >/dev/null 2>&1; then
    echo "Secret ${name} exists — remove manually to rotate: docker secret rm ${name}"
  else
    echo -n "$value" | docker secret create "$name" -
    echo "Created secret ${name}"
  fi
}

DATABASE_URL="$(resolve_database_url)"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "Warning: CRON_SECRET is empty — using placeholder; set a real value and rotate the secret later."
  CRON_SECRET="cron-secret-not-configured"
fi

create_or_update_secret postgres_password "${POSTGRES_PASSWORD}"
create_or_update_secret database_url "${DATABASE_URL}"
create_or_update_secret auth_secret "${AUTH_SECRET}"
create_or_update_secret auth_url "${AUTH_URL:-https://andiko.cloud}"
create_or_update_secret cron_secret "${CRON_SECRET}"

if [ -z "${CAP_SECRET_KEY:-}" ]; then
  echo "Warning: CAP_SECRET_KEY is empty — using placeholder; set a real value and rotate the secret later."
  CAP_SECRET_KEY="$CAP_SECRET_PLACEHOLDER"
fi
create_or_update_secret cap_secret "${CAP_SECRET_KEY}"

bash "$SCRIPT_DIR/sync-nginx-conf.sh"

echo ""
echo "Init complete. Next steps:"
echo "  1. Laptop: make prod-push TAG=vX.Y.Z"
echo "  2. VPS:    make prod-deploy TAG=vX.Y.Z"
echo "  3. VPS:    make prod-ssl && make prod-migrate && make prod-health"
