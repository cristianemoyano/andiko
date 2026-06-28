#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

rotate_secret() {
  local name="$1"
  local value="$2"
  if docker secret inspect "${name}" >/dev/null 2>&1; then
    echo "Removing existing secret ${name} ..."
    docker secret rm "${name}"
  fi
  echo -n "$value" | docker secret create "${name}" -
  echo "Created secret ${name}"
}

if [ -z "${CRON_SECRET:-}" ]; then
  CRON_SECRET="cron-secret-not-configured"
fi

DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}}"

rotate_secret postgres_password "${POSTGRES_PASSWORD}"
rotate_secret database_url "${DATABASE_URL}"
rotate_secret auth_secret "${AUTH_SECRET}"
rotate_secret auth_url "${AUTH_URL:-https://andiko.cloud}"
rotate_secret cron_secret "${CRON_SECRET}"

echo ""
echo "Secrets rotated. Redeploy the stack so services pick up new secrets:"
echo "  make prod-deploy TAG=your-tag"
