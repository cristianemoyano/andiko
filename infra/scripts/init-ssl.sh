#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
DOMAIN="${DOMAIN:-andiko.cloud}"
PORTAINER_DOMAIN="${PORTAINER_DOMAIN:-portainer.${DOMAIN}}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"

if [ -z "$CERTBOT_EMAIL" ]; then
  echo "Set CERTBOT_EMAIL in infra/.env.production for Let's Encrypt notifications." >&2
  exit 1
fi

if [ -f "${CERTBOT_CERTS_DIR}/live/${DOMAIN}/fullchain.pem" ]; then
  echo "Certificate already exists at ${CERTBOT_CERTS_DIR}/live/${DOMAIN}/"
  echo "If ${PORTAINER_DOMAIN} is missing from the cert, run: bash infra/scripts/expand-ssl-portainer.sh"
else
  echo "Requesting certificate for ${DOMAIN}, www.${DOMAIN}, ${PORTAINER_DOMAIN} ..."
  docker run --rm \
    -v "${CERTBOT_CERTS_DIR}:/etc/letsencrypt" \
    -v "${CERTBOT_WWW_DIR}:/var/www/certbot" \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$CERTBOT_EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.${DOMAIN}" \
    -d "$PORTAINER_DOMAIN"
fi

echo "Installing HTTPS nginx config ..."
FORCE_NGINX_SSL=1 bash "${SCRIPT_DIR}/sync-nginx-conf.sh"

NGINX_CONTAINER="$(docker ps -q -f name="${STACK}_nginx" | head -n1)"
if [ -n "$NGINX_CONTAINER" ]; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
  echo "Nginx reloaded."
else
  echo "Nginx container not found — redeploy stack: make prod-deploy TAG=..."
fi

echo "SSL setup complete."
echo "  App:       curl -sf https://${DOMAIN}/api/health"
echo "  Portainer: https://${PORTAINER_DOMAIN}/ (basic auth + Portainer admin login)"
