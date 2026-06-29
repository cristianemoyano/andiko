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
  if [ "$(id -u)" -eq 0 ] && command -v apt-get >/dev/null 2>&1; then
    echo "Installing apache2-utils (htpasswd) ..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y apache2-utils
  else
    echo "htpasswd not found. Install apache2-utils: sudo apt install -y apache2-utils" >&2
    exit 1
  fi
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
# nginx (worker user) must read this file inside the container — 600 causes auth_basic 500.
sudo chmod 644 "$PORTAINER_HTPASSWD_FILE"

echo "Wrote ${PORTAINER_HTPASSWD_FILE}"
echo "Redeploy nginx if already running: make prod-deploy TAG=..."
