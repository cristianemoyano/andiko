#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/lib/andiko/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/var/lib/andiko/postgres}"

mkdir -p "$BACKUP_LOCAL_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${BACKUP_LOCAL_DIR}/andiko-${TIMESTAMP}.sql"
ARCHIVE_FILE="${DUMP_FILE}.gz"

echo "Creating backup ${ARCHIVE_FILE} ..."

PG_CONTAINER="$(docker ps -q -f name="${STACK}_postgres" | head -n1)"
if [ -z "$PG_CONTAINER" ]; then
  echo "Postgres container not found for stack ${STACK}" >&2
  exit 1
fi

docker exec "$PG_CONTAINER" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl > "$DUMP_FILE"
gzip -f "$DUMP_FILE"

UPLOAD_FILE="$ARCHIVE_FILE"
if [ "${BACKUP_ENCRYPT:-no}" = "yes" ] && [ -n "${BACKUP_AGE_PUBLIC_KEY:-}" ]; then
  if ! command -v age >/dev/null 2>&1; then
    echo "age is required when BACKUP_ENCRYPT=yes" >&2
    exit 1
  fi
  ENCRYPTED_FILE="${ARCHIVE_FILE}.age"
  age -r "$BACKUP_AGE_PUBLIC_KEY" -o "$ENCRYPTED_FILE" "$ARCHIVE_FILE"
  rm -f "$ARCHIVE_FILE"
  UPLOAD_FILE="$ENCRYPTED_FILE"
  echo "Encrypted backup: ${UPLOAD_FILE}"
fi

if [ -n "${BACKUP_GDRIVE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  REMOTE="${BACKUP_GDRIVE_REMOTE}:${BACKUP_GDRIVE_FOLDER:-Andiko Prod Backups}"
  echo "Uploading to ${REMOTE} ..."
  rclone copy "$UPLOAD_FILE" "$REMOTE"
  echo "Upload complete."
elif [ -n "${BACKUP_GDRIVE_REMOTE:-}" ]; then
  echo "Warning: rclone not installed — backup saved locally only." >&2
fi

find "$BACKUP_LOCAL_DIR" -name 'andiko-*.sql.gz' -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true
find "$BACKUP_LOCAL_DIR" -name 'andiko-*.sql.gz.age' -mtime +"$BACKUP_RETENTION_DAYS" -delete 2>/dev/null || true

echo "Backup done: ${UPLOAD_FILE}"
