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
    if docker secret rm "${name}" 2>/dev/null; then
      echo "Removed secret ${name}"
    else
      echo "Cannot remove secret ${name} — stack is using it. Run:" >&2
      echo "  docker stack rm andiko && sleep 10 && make prod-secrets && make prod-deploy TAG=..." >&2
      exit 1
    fi
  fi
  echo -n "$value" | docker secret create "${name}" -
  echo "Created secret ${name}"
}

if [ -z "${CRON_SECRET:-}" ]; then
  CRON_SECRET="cron-secret-not-configured"
fi

DATABASE_URL="$(resolve_database_url)"

rotate_secret postgres_password "${POSTGRES_PASSWORD}"
rotate_secret database_url "${DATABASE_URL}"
rotate_secret auth_secret "${AUTH_SECRET}"
rotate_secret auth_url "${AUTH_URL:-https://andiko.cloud}"
rotate_secret cron_secret "${CRON_SECRET}"

echo ""
echo "Secrets rotated. Redeploy the stack so services pick up new secrets:"
echo "  make prod-deploy TAG=your-tag"
