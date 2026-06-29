#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

PORTAINER_AUTH_USER="${PORTAINER_AUTH_USER:-admin}"
PORTAINER_AUTH_PASSWORD="${PORTAINER_AUTH_PASSWORD:-}"
PORTAINER_HTPASSWD_FILE="${PORTAINER_HTPASSWD_FILE:-/var/lib/andiko/portainer/.htpasswd}"
PORTAINER_DATA_DIR="${PORTAINER_DATA_DIR:-/var/lib/andiko/portainer}"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "htpasswd not found. Install apache2-utils: sudo apt install -y apache2-utils" >&2
  exit 1
fi

if [ -z "$PORTAINER_AUTH_PASSWORD" ]; then
  PORTAINER_AUTH_PASSWORD="$(openssl rand -base64 24)"
  echo "Generated Portainer basic-auth password for ${PORTAINER_AUTH_USER}:"
  echo "  ${PORTAINER_AUTH_PASSWORD}"
  echo "Save this password — it is not stored anywhere else."
fi

sudo mkdir -p "$PORTAINER_DATA_DIR"
sudo mkdir -p "$(dirname "$PORTAINER_HTPASSWD_FILE")"

TMP_FILE="$(mktemp)"
htpasswd -nbB "$PORTAINER_AUTH_USER" "$PORTAINER_AUTH_PASSWORD" > "$TMP_FILE"
sudo mv "$TMP_FILE" "$PORTAINER_HTPASSWD_FILE"
sudo chmod 600 "$PORTAINER_HTPASSWD_FILE"

echo "Wrote ${PORTAINER_HTPASSWD_FILE}"
echo "Redeploy nginx if already running: make prod-deploy TAG=..."
