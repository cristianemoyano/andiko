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
