#!/usr/bin/env bash
# Rolling update of the app service only — does not touch postgres, nginx, mail, or stack secrets.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env
require_tag

STACK="$(stack_name)"
SERVICE="${STACK}_app"
IMAGE="${GHCR_IMAGE}:${TAG}"

if ! docker service inspect "$SERVICE" >/dev/null 2>&1; then
  echo "Service ${SERVICE} not found — bootstrap with: make prod-deploy-infra TAG=${TAG}" >&2
  exit 1
fi

echo "Pulling ${IMAGE} ..."
docker pull "$IMAGE"

echo "Rolling update ${SERVICE} → ${IMAGE} (start-first from stack update_config) ..."
docker service update --detach=false --image "$IMAGE" "$SERVICE"

echo ""
echo "App updated. Verify:"
echo "  make prod-health"
echo "  docker service ps ${SERVICE}"
