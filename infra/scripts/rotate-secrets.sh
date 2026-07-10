#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"

# Services that mount each secret (stack service name without stack prefix).
secret_services() {
  case "$1" in
    postgres_password) echo "postgres" ;;
    database_url) echo "app" ;;
    auth_secret|auth_url|cron_secret|cap_secret) echo "app" ;;
    *) echo "" ;;
  esac
}

rotate_secret_rolling() {
  local name="$1"
  local value="$2"
  local svc
  local new_name="${name}_$(date +%Y%m%d%H%M%S)"
  local updated=0

  echo -n "$value" | docker secret create "${new_name}" -

  svc="$(secret_services "$name")"
  if [ -n "$svc" ]; then
    local full="${STACK}_${svc}"
    if docker service inspect "${full}" >/dev/null 2>&1; then
      echo "Updating ${full} → secret ${name} (source ${new_name}) ..."
      docker service update \
        --secret-rm "${name}" \
        --secret-add "source=${new_name},target=${name}" \
        "${full}" >/dev/null
      updated=1
    fi
  fi

  if [ "$updated" -eq 0 ]; then
    echo "No running service uses secret ${name}; replacing in place ..."
    docker secret rm "${name}" 2>/dev/null || true
    echo -n "$value" | docker secret create "${name}" -
    docker secret rm "${new_name}" 2>/dev/null || true
    return
  fi

  echo "Waiting for ${full} to converge ..."
  docker service update --detach=false "${full}" >/dev/null 2>&1 || true

  if docker secret inspect "${name}" >/dev/null 2>&1; then
    if docker secret rm "${name}" 2>/dev/null; then
      echo "Removed old secret ${name}"
    else
      echo "Note: old secret ${name} still referenced; remove manually when safe."
    fi
  fi
  echo "Rotated secret ${name}"
}

if [ -z "${CRON_SECRET:-}" ]; then
  CRON_SECRET="cron-secret-not-configured"
fi

DATABASE_URL="$(resolve_database_url)"

echo "Rotating Swarm secrets with rolling service updates (no stack rm) ..."
echo ""

if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  echo "Syncing PostgreSQL role password before rotating postgres_password secret ..."
  PG_CONTAINER="$(docker ps -qf "name=${STACK}_postgres" | head -n1)"
  if [ -n "$PG_CONTAINER" ]; then
    export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB PG_CONTAINER
    python3 <<'PY'
import os
import subprocess

user = os.environ["POSTGRES_USER"]
password = os.environ["POSTGRES_PASSWORD"]
container = os.environ["PG_CONTAINER"]
db = os.environ["POSTGRES_DB"]
sql = f"ALTER USER \"{user}\" PASSWORD '{password.replace(chr(39), chr(39)+chr(39))}';"
subprocess.run(
    ["docker", "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", db, "-c", sql],
    check=True,
)
PY
  else
    echo "Warning: postgres container not found — skip ALTER USER; rotate postgres_password manually if needed." >&2
  fi
fi

rotate_secret_rolling postgres_password "${POSTGRES_PASSWORD}"
rotate_secret_rolling database_url "${DATABASE_URL}"
rotate_secret_rolling auth_secret "${AUTH_SECRET}"
rotate_secret_rolling auth_url "${AUTH_URL:-https://andiko.cloud}"
rotate_secret_rolling cron_secret "${CRON_SECRET}"
if [ -n "${CAP_SECRET_KEY:-}" ]; then
  rotate_secret_rolling cap_secret "${CAP_SECRET_KEY}"
fi

echo ""
echo "Secrets rotated. App/postgres services were updated in place."
echo "Verify: curl -sf https://andiko.cloud/api/health"
echo ""
echo "If app image also changed: make prod-deploy TAG=your-tag"
