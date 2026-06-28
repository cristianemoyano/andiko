#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

require_tag

IMAGE="${GHCR_IMAGE:-ghcr.io/cristianemoyano/andiko}"

echo "Building ${IMAGE}:${TAG} ..."
docker build -f "${REPO_ROOT}/infra/Dockerfile" -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" "${REPO_ROOT}"

echo "Pushing ${IMAGE}:${TAG} ..."
docker push "${IMAGE}:${TAG}"
docker push "${IMAGE}:latest"

DIGEST="$(docker inspect --format='{{index .RepoDigests 0}}' "${IMAGE}:${TAG}" 2>/dev/null || true)"
echo "Done. Pushed ${IMAGE}:${TAG}"
[ -n "$DIGEST" ] && echo "Digest: ${DIGEST}"
