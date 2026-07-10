#!/usr/bin/env bash
# Expand the existing Let's Encrypt cert to include analytics.${DOMAIN} and cap.${DOMAIN}.
# Run once on a VPS that already has HTTPS for andiko.cloud without these SANs.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
DOMAIN="${DOMAIN:-andiko.cloud}"
PORTAINER_DOMAIN="${PORTAINER_DOMAIN:-portainer.${DOMAIN}}"
UMAMI_DOMAIN="${UMAMI_DOMAIN:-analytics.${DOMAIN}}"
CAP_DOMAIN="${CAP_DOMAIN:-cap.${DOMAIN}}"
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

echo "Expanding certificate to include ${UMAMI_DOMAIN} and ${CAP_DOMAIN} ..."
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
  -d "$UMAMI_DOMAIN" \
  -d "$CAP_DOMAIN"

echo "Installing HTTPS nginx configs ..."
FORCE_NGINX_SSL=1 bash "${SCRIPT_DIR}/sync-nginx-conf.sh"

NGINX_CONTAINER="$(docker ps -q -f name="${STACK}_nginx" | head -n1)"
if [ -n "$NGINX_CONTAINER" ]; then
  docker exec "$NGINX_CONTAINER" nginx -s reload
  echo "Nginx reloaded."
else
  echo "Nginx container not found — redeploy stack: make prod-deploy TAG=..."
fi

echo "Done. Verify:"
echo "  curl -sf https://${UMAMI_DOMAIN}/api/heartbeat"
echo "  curl -sf -o /dev/null -w '%{http_code}' https://${CAP_DOMAIN}/"
