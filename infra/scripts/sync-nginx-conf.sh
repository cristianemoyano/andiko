#!/usr/bin/env bash
# Sync nginx site configs to NGINX_CONF_DIR (outside the git repo on VPS).
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

DOMAIN="${DOMAIN:-andiko.cloud}"
PORTAINER_DOMAIN="${PORTAINER_DOMAIN:-portainer.${DOMAIN}}"
UMAMI_DOMAIN="${UMAMI_DOMAIN:-analytics.${DOMAIN}}"
CAP_DOMAIN="${CAP_DOMAIN:-cap.${DOMAIN}}"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/var/lib/andiko/nginx/conf.d}"
CERT_PATH="${CERTBOT_CERTS_DIR}/live/${DOMAIN}/fullchain.pem"
REPO_CONF_DIR="${REPO_ROOT}/infra/nginx/conf.d"
TEMPLATES="${REPO_ROOT}/infra/nginx/templates"

sudo mkdir -p "$NGINX_CONF_DIR"

cert_has_san() {
  openssl x509 -in "$CERT_PATH" -noout -text 2>/dev/null | grep -q "DNS:$1"
}

install_http_bootstrap() {
  if [ ! -f "${NGINX_CONF_DIR}/default.conf" ]; then
    echo "Installing HTTP bootstrap → ${NGINX_CONF_DIR}/default.conf"
    sudo cp "${REPO_CONF_DIR}/default.conf" "${NGINX_CONF_DIR}/default.conf"
  fi
  if [ ! -f "${NGINX_CONF_DIR}/portainer.conf" ]; then
    echo "Installing Portainer HTTP bootstrap → ${NGINX_CONF_DIR}/portainer.conf"
    sudo cp "${REPO_CONF_DIR}/portainer.conf" "${NGINX_CONF_DIR}/portainer.conf"
  fi
  if [ ! -f "${NGINX_CONF_DIR}/analytics.conf" ]; then
    echo "Installing Umami HTTP bootstrap → ${NGINX_CONF_DIR}/analytics.conf"
    sudo cp "${REPO_CONF_DIR}/analytics.conf" "${NGINX_CONF_DIR}/analytics.conf"
  fi
  if [ ! -f "${NGINX_CONF_DIR}/cap.conf" ]; then
    echo "Installing Cap HTTP bootstrap → ${NGINX_CONF_DIR}/cap.conf"
    sudo cp "${REPO_CONF_DIR}/cap.conf" "${NGINX_CONF_DIR}/cap.conf"
  fi
}

install_ssl_configs() {
  echo "Installing HTTPS nginx configs in ${NGINX_CONF_DIR} ..."
  sudo cp "${TEMPLATES}/andiko.ssl.conf" "${NGINX_CONF_DIR}/default.conf"

  if cert_has_san "${PORTAINER_DOMAIN}"; then
    sudo cp "${TEMPLATES}/portainer.ssl.conf" "${NGINX_CONF_DIR}/portainer.conf"
    echo "Installed portainer.conf (portainer SSL)."
  else
    echo "Portainer SAN not in cert — run expand-ssl-portainer.sh if needed."
  fi

  if cert_has_san "${UMAMI_DOMAIN}"; then
    sudo cp "${TEMPLATES}/analytics.ssl.conf" "${NGINX_CONF_DIR}/analytics.conf"
    echo "Installed analytics.conf (umami SSL)."
  else
    echo "Umami SAN not in cert — run expand-ssl-services.sh if needed."
  fi

  if cert_has_san "${CAP_DOMAIN}"; then
    sudo cp "${TEMPLATES}/cap.ssl.conf" "${NGINX_CONF_DIR}/cap.conf"
    echo "Installed cap.conf (cap SSL)."
  else
    echo "Cap SAN not in cert — run expand-ssl-services.sh if needed."
  fi
}

needs_ssl_upgrade() {
  [ ! -f "${NGINX_CONF_DIR}/default.conf" ] && return 0
  grep -q 'listen 443' "${NGINX_CONF_DIR}/default.conf" 2>/dev/null && return 1
  return 0
}

install_http_bootstrap

if [ -f "$CERT_PATH" ]; then
  if [ "${FORCE_NGINX_SSL:-0}" = "1" ] || needs_ssl_upgrade; then
    install_ssl_configs
  fi
else
  echo "No TLS certificate at ${CERT_PATH} — using HTTP bootstrap in ${NGINX_CONF_DIR}."
fi
