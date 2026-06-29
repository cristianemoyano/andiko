#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
BRANCH="${RELEASE_BRANCH:-develop}"
[ -n "$BRANCH" ] || BRANCH=develop
SKIP_PULL="${SKIP_PULL:-0}"
SKIP_PUSH="${SKIP_PUSH:-0}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"
WAIT_SECONDS="${RELEASE_WAIT_SECONDS:-120}"
[ -n "$WAIT_SECONDS" ] || WAIT_SECONDS=120

if [ "$SKIP_PULL" != "1" ]; then
  echo "Pulling latest code (origin/${BRANCH}) ..."
  git -C "$REPO_ROOT" pull origin "$BRANCH"
else
  echo "Skipping git pull (SKIP_PULL=1)."
fi

resolve_release_tag

wait_for_app() {
  local service="${STACK}_app"
  local elapsed=0

  echo "Waiting for ${service} to reach 1/1 replicas (max ${WAIT_SECONDS}s) ..."
  while [ "$elapsed" -lt "$WAIT_SECONDS" ]; do
    local replicas
    replicas="$(docker service ls --filter "name=${service}" --format '{{.Replicas}}' 2>/dev/null | head -n1 || true)"
    if [ "$replicas" = "1/1" ]; then
      echo "${service} is running."
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "Timed out waiting for ${service}. Current replicas: ${replicas:-unknown}" >&2
  docker stack ps "$STACK" --no-trunc >&2 || true
  exit 1
}

run_health() {
  local url="${HEALTH_URL:-https://andiko.cloud/api/health}"
  echo "Health check: ${url}"
  curl -sf "$url" | cat
  echo ""
}

echo "=== Andiko release ${TAG} ==="

if [ "$SKIP_PUSH" != "1" ]; then
  TAG="$TAG" bash "$SCRIPT_DIR/push-image.sh"
else
  echo "Skipping image build/push (SKIP_PUSH=1)."
fi

if [ "$SKIP_MIGRATE" != "1" ]; then
  TAG="$TAG" bash "$SCRIPT_DIR/migrate.sh" up
else
  echo "Skipping migrations (SKIP_MIGRATE=1)."
fi

TAG="$TAG" bash "$SCRIPT_DIR/deploy.sh"
wait_for_app
run_health

echo ""
echo "Release ${TAG} complete."
