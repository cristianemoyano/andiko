#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

require_tag

IMAGE="${GHCR_IMAGE:-ghcr.io/cristianemoyano/andiko}"

if ! grep -q '"ghcr.io"' "${HOME}/.docker/config.json" 2>/dev/null; then
  echo "Not logged in to ghcr.io. Run:" >&2
  echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin" >&2
  echo "PAT scopes required: write:packages, read:packages (classic token)." >&2
  exit 1
fi

echo "Building ${IMAGE}:${TAG} ..."
docker build -f "${REPO_ROOT}/infra/Dockerfile" -t "${IMAGE}:${TAG}" -t "${IMAGE}:latest" "${REPO_ROOT}"

echo "Pushing ${IMAGE}:${TAG} ..."
if ! docker push "${IMAGE}:${TAG}"; then
  echo "" >&2
  echo "Push denied by GHCR. Common fixes:" >&2
  echo "  1. PAT with write:packages + read:packages (https://github.com/settings/tokens)" >&2
  echo "  2. docker login ghcr.io -u YOUR_GITHUB_USERNAME  (username, not email)" >&2
  echo "  3. GHCR_IMAGE owner must match the logged-in user/org: ${IMAGE}" >&2
  echo "  4. If org uses SSO, authorize the PAT for that org" >&2
  exit 1
fi
docker push "${IMAGE}:latest"

DIGEST="$(docker inspect --format='{{index .RepoDigests 0}}' "${IMAGE}:${TAG}" 2>/dev/null || true)"
echo "Done. Pushed ${IMAGE}:${TAG}"
[ -n "$DIGEST" ] && echo "Digest: ${DIGEST}"
