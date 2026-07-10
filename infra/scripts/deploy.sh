#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env
require_tag

STACK="$(stack_name)"
export REPO_ROOT
export IMAGE_TAG="$TAG"
export POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/var/lib/andiko/postgres}"
export CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"
export CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"
export PORTAINER_DATA_DIR="${PORTAINER_DATA_DIR:-/var/lib/andiko/portainer}"
export PORTAINER_HTPASSWD_FILE="${PORTAINER_HTPASSWD_FILE:-/var/lib/andiko/portainer/.htpasswd}"
export NGINX_CONF_DIR="${NGINX_CONF_DIR:-/var/lib/andiko/nginx/conf.d}"
export MAIL_DATA_DIR="${MAIL_DATA_DIR:-/var/lib/andiko/mail/data}"
export MAIL_STATE_DIR="${MAIL_STATE_DIR:-/var/lib/andiko/mail/state}"
export MAIL_CONFIG_DIR="${MAIL_CONFIG_DIR:-/var/lib/andiko/mail/config}"
export MAIL_ENV_FILE="${MAIL_ENV_FILE:-${REPO_ROOT}/infra/mail/docker-mailserver.env}"
export UMAMI_DATA_DIR="${UMAMI_DATA_DIR:-/var/lib/andiko/umami-db}"
export UMAMI_POSTGRES_USER="${UMAMI_POSTGRES_USER:-umami}"
export UMAMI_POSTGRES_DB="${UMAMI_POSTGRES_DB:-umami}"

if [ ! -f "$MAIL_ENV_FILE" ]; then
  echo "Warning: ${MAIL_ENV_FILE} not found — run: make prod-init-mail" >&2
fi

if [ ! -f "$PORTAINER_HTPASSWD_FILE" ]; then
  echo "Warning: ${PORTAINER_HTPASSWD_FILE} not found — nginx will fail until you run: make prod-portainer-auth" >&2
fi

ensure_cap_secret
ensure_umami_data_dir
validate_umami_cap_env

bash "$SCRIPT_DIR/sync-nginx-conf.sh"

echo "Pulling ${GHCR_IMAGE}:${TAG} ..."
docker pull "${GHCR_IMAGE}:${TAG}"

echo "Deploying stack ${STACK} (full — app + infra) ..."
envsubst '${GHCR_IMAGE} ${IMAGE_TAG} ${AFIP_MODE} ${POSTGRES_USER} ${POSTGRES_DB} ${REPO_ROOT} ${POSTGRES_DATA_DIR} ${CERTBOT_CERTS_DIR} ${CERTBOT_WWW_DIR} ${PORTAINER_DATA_DIR} ${PORTAINER_HTPASSWD_FILE} ${NGINX_CONF_DIR} ${NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN} ${NEXT_PUBLIC_POSTHOG_HOST} ${NEXT_PUBLIC_UMAMI_HOST} ${NEXT_PUBLIC_UMAMI_WEBSITE_ID} ${NEXT_PUBLIC_CAP_SITE_KEY} ${NEXT_PUBLIC_CAP_HOST} ${CAP_VERIFY_URL} ${UMAMI_DATA_DIR} ${UMAMI_POSTGRES_USER} ${UMAMI_POSTGRES_PASSWORD} ${UMAMI_POSTGRES_DB} ${UMAMI_APP_SECRET} ${CAP_ADMIN_KEY} ${MAIL_DATA_DIR} ${MAIL_STATE_DIR} ${MAIL_CONFIG_DIR} ${MAIL_ENV_FILE}' \
  < "${REPO_ROOT}/infra/docker-stack.yml" \
  | docker stack deploy -c - "$STACK"

echo ""
echo "Stack deployed. Wait for services to become healthy, then run:"
echo "  make prod-migrate"
echo "  make prod-health"

docker stack services "$STACK"
