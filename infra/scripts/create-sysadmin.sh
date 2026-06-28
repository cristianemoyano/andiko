#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env
require_tag

if [ -z "${EMAIL:-}" ]; then
  echo "EMAIL is required: make prod-create-sysadmin TAG=v0.25.3 EMAIL=admin@andiko.cloud PASSWORD=..." >&2
  exit 1
fi

if [ -z "${PASSWORD:-}" ]; then
  echo "PASSWORD is required (min 16 chars): make prod-create-sysadmin TAG=... EMAIL=... PASSWORD=..." >&2
  exit 1
fi

if [ "${#PASSWORD}" -lt 16 ]; then
  echo "PASSWORD must be at least 16 characters." >&2
  exit 1
fi

NETWORK="$(internal_network)"
IMAGE="${GHCR_IMAGE}:${TAG}"
DATABASE_URL="$(resolve_database_url)"
SYSADMIN_SCRIPT="${REPO_ROOT}/src/db/create-sysadmin.ts"

if [ ! -f "$SYSADMIN_SCRIPT" ]; then
  echo "Missing ${SYSADMIN_SCRIPT}" >&2
  exit 1
fi

echo "Creating sys-admin ${EMAIL} on ${IMAGE} ..."

docker run --rm \
  --network "$NETWORK" \
  -v "${SYSADMIN_SCRIPT}:/app/src/db/create-sysadmin.ts:ro" \
  -e NODE_ENV=development \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_SECRET="${AUTH_SECRET}" \
  -e AUTH_URL="${AUTH_URL:-https://andiko.cloud}" \
  -e AFIP_MODE="${AFIP_MODE:-produccion}" \
  -e SYSADMIN_EMAIL="$EMAIL" \
  -e SYSADMIN_PASSWORD="$PASSWORD" \
  -e SYSADMIN_NAME="${NAME:-Sys Admin}" \
  "$IMAGE" \
  node --import tsx src/db/create-sysadmin.ts

echo "Done. Login at ${AUTH_URL:-https://andiko.cloud}/login"
