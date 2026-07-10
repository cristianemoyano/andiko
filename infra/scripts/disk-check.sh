#!/usr/bin/env bash
# Host and Docker disk usage report for the production VPS.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/var/lib/andiko/postgres}"
PORTAINER_DATA_DIR="${PORTAINER_DATA_DIR:-/var/lib/andiko/portainer}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/andiko/backups}"
CERTBOT_CERTS_DIR="${CERTBOT_CERTS_DIR:-/var/lib/andiko/certs}"
CERTBOT_WWW_DIR="${CERTBOT_WWW_DIR:-/var/lib/andiko/certbot-www}"
UMAMI_DATA_DIR="${UMAMI_DATA_DIR:-/var/lib/andiko/umami-db}"
DISK_CRIT_PCT="${DISK_CRIT_PCT:-95}"

section() {
  echo ""
  echo "=== $1 ==="
}

root_use_pct() {
  df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }'
}

section "Host filesystem"
df -hP /
echo ""
df -hP | awk 'NR==1 || $1 ~ /^\/dev\// { print }'

ROOT_PCT="$(root_use_pct)"
echo ""
echo "Root (/) usage: ${ROOT_PCT}%"

section "Andiko data directories"
ANDIKO_BASE="/var/lib/andiko"
if [ -d "$ANDIKO_BASE" ]; then
  du -sh "$ANDIKO_BASE"/* 2>/dev/null | sort -hr || true
else
  echo "${ANDIKO_BASE} not found"
fi

for label_path in \
  "postgres:${POSTGRES_DATA_DIR}" \
  "backups:${BACKUP_LOCAL_DIR}" \
  "certs:${CERTBOT_CERTS_DIR}" \
  "portainer:${PORTAINER_DATA_DIR}" \
  "umami-db:${UMAMI_DATA_DIR}" \
  "nginx-conf:${NGINX_CONF_DIR}"; do
  label="${label_path%%:*}"
  path="${label_path#*:}"
  if [ -d "$path" ]; then
    size="$(du -sh "$path" 2>/dev/null | cut -f1)"
    echo "  ${label}: ${size} (${path})"
  fi
done

section "Docker disk usage"
if command -v docker >/dev/null 2>&1; then
  docker system df
  echo ""
  echo "Images (andiko):"
  docker images "${GHCR_IMAGE:-ghcr.io/cristianemoyano/andiko}" --format '  {{.Tag}}\t{{.Size}}\t{{.ID}}' 2>/dev/null | head -10 || true
  echo ""
  STOPPED="$(docker ps -a --filter status=exited -q 2>/dev/null | wc -l | tr -d ' ')"
  DANGLING="$(docker images -f dangling=true -q 2>/dev/null | wc -l | tr -d ' ')"
  echo "Stopped containers: ${STOPPED}"
  echo "Dangling images: ${DANGLING}"
  if [ -d /var/lib/docker ]; then
    echo "Docker root: $(du -sh /var/lib/docker 2>/dev/null | cut -f1) (/var/lib/docker)"
  fi
else
  echo "docker not installed"
fi

section "Logs"
for log in /var/log/andiko-backup.log /var/log/andiko-certbot.log; do
  if [ -f "$log" ]; then
    echo "  $(du -sh "$log" | cut -f1)  ${log}"
  fi
done

section "Swarm stack"
if docker info 2>/dev/null | grep -q 'Swarm: active'; then
  docker stack services "$STACK" 2>/dev/null || true
else
  echo "Swarm not active"
fi

echo ""
if [ "$ROOT_PCT" -ge "$DISK_CRIT_PCT" ]; then
  echo "CRITICAL: root filesystem at ${ROOT_PCT}% (threshold ${DISK_CRIT_PCT}%)."
  echo "Consider: make prod-backup, then make prod-prune (safe Docker cleanup)."
  exit 1
fi
if [ "$ROOT_PCT" -ge "$DISK_WARN_PCT" ]; then
  echo "WARNING: root filesystem at ${ROOT_PCT}% (threshold ${DISK_WARN_PCT}%)."
  exit 2
fi
echo "OK: root filesystem at ${ROOT_PCT}%."
