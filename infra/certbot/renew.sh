#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
# shellcheck source=../scripts/_common.sh
. "$SCRIPT_DIR/../scripts/_common.sh"

load_env

STACK="$(stack_name)"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"
CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"

docker run --rm \
  -v "${CERTBOT_CERTS_DIR}:/etc/letsencrypt" \
  -v "${CERTBOT_WWW_DIR}:/var/www/certbot" \
  certbot/certbot renew --quiet

NGINX_CONTAINER="$(docker ps -q -f name="${STACK}_nginx" | head -n1)"
if [ -n "$NGINX_CONTAINER" ]; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
fi

MAIL_SERVICE="${STACK}_mailserver"
if docker service ls --format '{{.Name}}' 2>/dev/null | grep -qx "$MAIL_SERVICE"; then
  docker service update --force "$MAIL_SERVICE" >/dev/null 2>&1 || true
  echo "Mailserver restart triggered (TLS reload)."
fi

echo "Certificate renewal check complete."
