#!/usr/bin/env bash
# Purge Umami analytics data older than UMAMI_RETENTION_DAYS (default 90).
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
UMAMI_RETENTION_DAYS="${UMAMI_RETENTION_DAYS:-90}"
UMAMI_POSTGRES_USER="${UMAMI_POSTGRES_USER:-umami}"
UMAMI_POSTGRES_DB="${UMAMI_POSTGRES_DB:-umami}"

if [ "$UMAMI_RETENTION_DAYS" = "0" ]; then
  echo "UMAMI_RETENTION_DAYS=0 — purge disabled."
  exit 0
fi

PG_CONTAINER="$(docker ps -qf "name=${STACK}_umami_db" | head -n1)"
if [ -z "$PG_CONTAINER" ]; then
  echo "umami_db container not found for stack ${STACK}." >&2
  exit 1
fi

echo "Purging Umami data older than ${UMAMI_RETENTION_DAYS} days ..."

docker exec "$PG_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$UMAMI_POSTGRES_USER" -d "$UMAMI_POSTGRES_DB" <<SQL
BEGIN;

DELETE FROM event_data
WHERE event_id IN (
  SELECT event_id FROM website_event
  WHERE created_at < NOW() - INTERVAL '${UMAMI_RETENTION_DAYS} days'
);

DELETE FROM website_event
WHERE created_at < NOW() - INTERVAL '${UMAMI_RETENTION_DAYS} days';

DELETE FROM session_data
WHERE session_id IN (
  SELECT session_id FROM session
  WHERE created_at < NOW() - INTERVAL '${UMAMI_RETENTION_DAYS} days'
);

DELETE FROM session
WHERE created_at < NOW() - INTERVAL '${UMAMI_RETENTION_DAYS} days';

COMMIT;

VACUUM ANALYZE event_data;
VACUUM ANALYZE website_event;
VACUUM ANALYZE session_data;
VACUUM ANALYZE session;
SQL

echo "Umami purge complete."
