#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env
require_tag

STACK="$(stack_name)"
NETWORK="$(internal_network)"
IMAGE="${GHCR_IMAGE}:${TAG}"
CMD="${1:-up}"

DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}}"

run_migrate() {
  docker run --rm \
    --network "$NETWORK" \
    -e NODE_ENV=development \
    -e DATABASE_URL="$DATABASE_URL" \
    -e AUTH_SECRET="${AUTH_SECRET}" \
    -e AUTH_URL="${AUTH_URL:-https://andiko.cloud}" \
    -e AFIP_MODE="${AFIP_MODE:-produccion}" \
    "$IMAGE" \
    node --import tsx src/db/migrate.ts "$@"
}

case "$CMD" in
  up)
    echo "Running migrations on ${IMAGE} ..."
    run_migrate up
    echo "Migrations complete."
    ;;
  status)
    run_migrate status
    ;;
  *)
    echo "Usage: migrate.sh [up|status]" >&2
    exit 1
    ;;
esac
