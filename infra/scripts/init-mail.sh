#!/usr/bin/env bash
# One-time bootstrap for docker-mailserver volumes and env on the VPS.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

MAIL_DATA_DIR="${MAIL_DATA_DIR:-/var/lib/andiko/mail/data}"
MAIL_STATE_DIR="${MAIL_STATE_DIR:-/var/lib/andiko/mail/state}"
MAIL_CONFIG_DIR="${MAIL_CONFIG_DIR:-/var/lib/andiko/mail/config}"
MAIL_ENV_FILE="${MAIL_ENV_FILE:-${REPO_ROOT}/infra/mail/docker-mailserver.env}"
MAIL_ENV_EXAMPLE="${REPO_ROOT}/infra/mail/docker-mailserver.env.example"

echo "==> Andiko mail server bootstrap"

for dir in "$MAIL_DATA_DIR" "$MAIL_STATE_DIR" "$MAIL_CONFIG_DIR"; do
  mkdir -p "$dir"
  echo "  ${dir}"
done

if [ ! -f "$MAIL_ENV_FILE" ]; then
  if [ ! -f "$MAIL_ENV_EXAMPLE" ]; then
    echo "Missing ${MAIL_ENV_EXAMPLE}" >&2
    exit 1
  fi
  cp "$MAIL_ENV_EXAMPLE" "$MAIL_ENV_FILE"
  echo "Created ${MAIL_ENV_FILE} from example — review before prod-deploy."
else
  echo "Env file already exists: ${MAIL_ENV_FILE}"
fi

echo ""
echo "Mail bootstrap complete."
echo ""
echo "Next steps:"
echo "  1. Hostinger: unblock port 25, set PTR mail.andiko.cloud (see docs/deployment/mail-server.md)"
echo "  2. DNS: A/MX/SPF/DMARC for andiko.cloud"
echo "  3. bash infra/scripts/expand-ssl-mail.sh"
echo "  4. make prod-deploy TAG=..."
echo "  5. make prod-mail-add-user EMAIL=postmaster@andiko.cloud PASSWORD=..."
echo "  6. make prod-mail-dkim  # publish TXT in DNS"
