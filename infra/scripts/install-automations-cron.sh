#!/usr/bin/env bash
# Installs (or removes, with --remove) the once-a-minute crontab entry that drives the
# automations scheduler (see docs/deployment/production.md, "Other cron jobs"). Safe to
# re-run: the entry is tagged with a marker comment and replaced in place rather than
# duplicated. Idempotent by design on the app side too (see runDueScheduledTasks), so
# running this on more than one host is safe, just redundant.
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

MARKER="# andiko-automations-tick"

usage() {
  echo "Usage: $0 [--remove]" >&2
  echo "  (no args)  Install/update the crontab entry for the automations tick." >&2
  echo "  --remove   Remove the crontab entry." >&2
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "${1:-}" = "--remove" ]; then
  crontab -l 2>/dev/null | grep -vF "$MARKER" | crontab -
  echo "Removed automations-tick crontab entry (if it was present)."
  exit 0
fi

load_env

DOMAIN="${DOMAIN:?Set DOMAIN in infra/.env.production}"
CRON_SECRET="${CRON_SECRET:?Set CRON_SECRET in infra/.env.production}"

LINE="* * * * * curl -sf -X POST -H \"Authorization: Bearer ${CRON_SECRET}\" https://${DOMAIN}/api/v1/sys-admin/jobs/automations-tick >/dev/null 2>&1 ${MARKER}"

(crontab -l 2>/dev/null | grep -vF "$MARKER"; echo "$LINE") | crontab -

echo "Installed automations-tick crontab entry (every minute, https://${DOMAIN}):"
crontab -l | grep -F "$MARKER"
