#!/usr/bin/env bash
# Expand the existing Let's Encrypt cert to include mail.${DOMAIN}.
# Run once on a VPS that already has HTTPS for andiko.cloud.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
DOMAIN="${DOMAIN:-andiko.cloud}"
MAIL_DOMAIN="${MAIL_DOMAIN:-mail.${DOMAIN}}"
PORTAINER_DOMAIN="${PORTAINER_DOMAIN:-portainer.${DOMAIN}}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "Set CERTBOT_EMAIL in infra/.env.production" >&2
  exit 1
fi

if [ ! -f "${CERTBOT_CERTS_DIR}/live/${DOMAIN}/fullchain.pem" ]; then
  echo "No certificate at ${CERTBOT_CERTS_DIR}/live/${DOMAIN}/ — run make prod-ssl first." >&2
  exit 1
fi

echo "Expanding certificate to include ${MAIL_DOMAIN} ..."
docker run --rm \
  -v "${CERTBOT_CERTS_DIR}:/etc/letsencrypt" \
  -v "${CERTBOT_WWW_DIR}:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  --expand \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}" \
  -d "$PORTAINER_DOMAIN" \
  -d "$MAIL_DOMAIN"

echo "Installing HTTPS nginx configs ..."
FORCE_NGINX_SSL=1 bash "${SCRIPT_DIR}/sync-nginx-conf.sh"

NGINX_CONTAINER="$(docker ps -q -f name="${STACK}_nginx" | head -n1)"
if [ -n "$NGINX_CONTAINER" ]; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
  echo "Nginx reloaded."
else
  echo "Nginx container not found — redeploy stack: make prod-deploy TAG=..."
fi

MAIL_CONTAINER="$(docker ps -q -f name="${STACK}_mailserver" | head -n1)"
if [ -n "$MAIL_CONTAINER" ]; then
  echo "Restarting mailserver to pick up new certificate ..."
  docker service update --force "${STACK}_mailserver" >/dev/null
  echo "Mailserver restart triggered."
else
  echo "Mailserver not running yet — deploy stack after this step."
fi

echo "Done. Verify cert SAN:"
openssl x509 -in "${CERTBOT_CERTS_DIR}/live/${DOMAIN}/fullchain.pem" -noout -text | grep -A1 'Subject Alternative Name' || true
