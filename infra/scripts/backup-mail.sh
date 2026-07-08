#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/andiko/backups}"
MAIL_DATA_DIR="${MAIL_DATA_DIR:-/var/lib/andiko/mail/data}"
MAIL_STATE_DIR="${MAIL_STATE_DIR:-/var/lib/andiko/mail/state}"
MAIL_CONFIG_DIR="${MAIL_CONFIG_DIR:-/var/lib/andiko/mail/config}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_LOCAL_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_FILE="${BACKUP_LOCAL_DIR}/andiko-mail-${TIMESTAMP}.tar.gz"

echo "Creating mail backup ${ARCHIVE_FILE} ..."

tar -czf "$ARCHIVE_FILE" \
  -C "$(dirname "$MAIL_DATA_DIR")" "$(basename "$MAIL_DATA_DIR")" \
  -C "$(dirname "$MAIL_STATE_DIR")" "$(basename "$MAIL_STATE_DIR")" \
  -C "$(dirname "$MAIL_CONFIG_DIR")" "$(basename "$MAIL_CONFIG_DIR")"

if [ -n "${BACKUP_GDRIVE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  REMOTE="${BACKUP_GDRIVE_REMOTE}:${BACKUP_GDRIVE_FOLDER:-andiko-prod-backups}"
  echo "Uploading to ${REMOTE} ..."
  rclone copy "$ARCHIVE_FILE" "$REMOTE"
  echo "Upload complete."
fi

find "$BACKUP_LOCAL_DIR" -name 'andiko-mail-*.tar.gz' -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

echo "Mail backup done: ${ARCHIVE_FILE}"
