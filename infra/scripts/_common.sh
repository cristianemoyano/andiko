#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)"
fi

ENV_FILE="${REPO_ROOT}/infra/.env.production"

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE — copy infra/.env.production.example and fill in values." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

require_tag() {
  if [ -z "${TAG:-}" ]; then
    echo "TAG is required (e.g. make prod-deploy TAG=v0.26.0)" >&2
    exit 1
  fi
  export IMAGE_TAG="$TAG"
}

stack_name() {
  echo "${STACK_NAME:-andiko}"
}

internal_network() {
  echo "$(stack_name)_internal"
}

# Build a valid PostgreSQL URL (percent-encode user/password for special chars in openssl base64).
build_database_url() {
  local user="${1:?user}"
  local password="${2:?password}"
  local host="${3:-postgres}"
  local port="${4:-5432}"
  local db="${5:?db}"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to build DATABASE_URL (apt install python3)." >&2
    exit 1
  fi

  POSTGRES_USER="$user" POSTGRES_PASSWORD="$password" POSTGRES_HOST="$host" POSTGRES_PORT="$port" POSTGRES_DB="$db" \
    python3 -c 'import os, urllib.parse
u = os.environ["POSTGRES_USER"]
p = os.environ["POSTGRES_PASSWORD"]
h = os.environ["POSTGRES_HOST"]
port = os.environ["POSTGRES_PORT"]
d = os.environ["POSTGRES_DB"]
print(f"postgresql://{urllib.parse.quote(u, safe=\"\")}:{urllib.parse.quote(p, safe=\"\")}@{h}:{port}/{urllib.parse.quote(d, safe=\"\")}")'
}

# Prefer POSTGRES_* (encoded) over a raw DATABASE_URL line in .env.production.
resolve_database_url() {
  if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    build_database_url "$POSTGRES_USER" "$POSTGRES_PASSWORD" "postgres" "5432" "$POSTGRES_DB"
  elif [ -n "${DATABASE_URL:-}" ]; then
    echo "$DATABASE_URL"
  else
    echo "Set POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (or DATABASE_URL) in infra/.env.production" >&2
    exit 1
  fi
}
