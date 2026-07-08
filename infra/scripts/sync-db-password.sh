#!/usr/bin/env bash
# Sync PostgreSQL role password to infra/.env.production and restart app only.
# Use when /api/health returns db: disconnected but postgres is running — avoids stack rm.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
PG_CONTAINER="$(docker ps -qf "name=${STACK}_postgres" | head -n1)"
if [ -z "$PG_CONTAINER" ]; then
  echo "Postgres container not found (expected name=${STACK}_postgres)." >&2
  exit 1
fi

echo "Syncing PostgreSQL password for user ${POSTGRES_USER} from infra/.env.production ..."
export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB PG_CONTAINER
python3 <<'PY'
import os
import subprocess

user = os.environ["POSTGRES_USER"]
password = os.environ["POSTGRES_PASSWORD"]
container = os.environ["PG_CONTAINER"]
sql = f"ALTER USER \"{user}\" PASSWORD '{password.replace(chr(39), chr(39)+chr(39))}';"
subprocess.run(
    ["docker", "exec", container, "psql", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", os.environ["POSTGRES_DB"], "-c", sql],
    check=True,
)
PY

echo "Rolling restart of ${STACK}_app (no stack rm) ..."
docker service update --force "${STACK}_app" >/dev/null

echo ""
echo "Done. Verify:"
echo "  curl -sf https://andiko.cloud/api/health"
echo ""
echo "If health still fails, DATABASE_URL secret may differ from .env — run:"
echo "  make prod-secrets   # rolling secret update, no stack rm"
echo "  make prod-deploy TAG=your-tag"
