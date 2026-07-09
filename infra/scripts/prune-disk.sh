#!/usr/bin/env bash
# Safe Docker disk cleanup for the production VPS.
# Never prunes volumes, networks in use, or images referenced by running Swarm services.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
GHCR_IMAGE="${GHCR_IMAGE:-ghcr.io/cristianemoyano/andiko}"
APP_SERVICE="${STACK}_app"
DRY_RUN="${PRUNE_DRY_RUN:-0}"

section() {
  echo ""
  echo "=== $1 ==="
}

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
    return 0
  fi
  echo ">> $*"
  "$@"
}

# docker images uses 12-char IDs; image inspect returns sha256:<64 hex> — compare by prefix.
image_id_prefix() {
  local id="${1#sha256:}"
  echo "${id:0:12}"
}

same_image_id() {
  local a b
  a="$(image_id_prefix "$1")"
  b="$(image_id_prefix "$2")"
  [ -n "$a" ] && [ -n "$b" ] && [ "$a" = "$b" ]
}

current_app_image_id() {
  local image
  image="$(docker service inspect "$APP_SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
  [ -n "$image" ] || return 1
  docker image inspect "$image" --format '{{.Id}}' 2>/dev/null || true
}

prune_old_andiko_release_images() {
  local current_id="$1"
  local tag id

  if [ -z "$current_id" ]; then
    echo "Skipping old Andiko images — could not resolve ${APP_SERVICE} image."
    return 0
  fi

  echo "Keeping image in use by ${APP_SERVICE}: ${current_id}"

  while read -r tag id; do
    [ -z "$tag" ] && continue
    if same_image_id "$id" "$current_id"; then
      echo "  Keeping ${GHCR_IMAGE}:${tag} (in use)"
      continue
    fi
    case "$tag" in
      v*) ;;
      latest) ;;
      *) continue ;;
    esac
    run docker rmi "${GHCR_IMAGE}:${tag}" 2>/dev/null || echo "  (skip ${tag}: still referenced)"
  done < <(docker images "$GHCR_IMAGE" --format '{{.Tag}} {{.ID}}' 2>/dev/null || true)
}

section "Andiko safe disk prune"
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY RUN — no changes will be made (PRUNE_DRY_RUN=1)."
fi
echo "Does NOT prune: volumes, Swarm data under /var/lib/andiko, images used by running services."

section "Before"
docker system df 2>/dev/null || true

section "Stopped containers"
run docker container prune -f

section "Dangling images"
run docker image prune -f

section "Build cache"
if [ "${PRUNE_BUILDER_ALL:-0}" = "1" ]; then
  echo "PRUNE_BUILDER_ALL=1 — removing all unused build cache."
  run docker builder prune -a -f
else
  echo "Removing build cache unused for 48h+ (set PRUNE_BUILDER_ALL=1 for full cache wipe)."
  run docker builder prune -f
fi

section "Old Andiko release images"
CURRENT_ID="$(current_app_image_id || true)"
prune_old_andiko_release_images "$CURRENT_ID"

section "After"
docker system df 2>/dev/null || true
df -hP / | awk 'NR==1 || NR==2'

echo ""
if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run complete. Re-run without PRUNE_DRY_RUN=1 to apply."
else
  echo "Prune complete. Verify stack: docker stack services ${STACK}"
  echo "Health: make prod-health"
fi
