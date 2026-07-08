#!/usr/bin/env bash
# docker-mailserver helpers (add user, DKIM, logs, restart).
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh"

load_env

STACK="$(stack_name)"
MAIL_IMAGE="${MAIL_IMAGE:-ghcr.io/docker-mailserver/docker-mailserver:latest}"
MAIL_DATA_DIR="${MAIL_DATA_DIR:-/var/lib/andiko/mail/data}"
MAIL_STATE_DIR="${MAIL_STATE_DIR:-/var/lib/andiko/mail/state}"
MAIL_CONFIG_DIR="${MAIL_CONFIG_DIR:-/var/lib/andiko/mail/config}"

mail_volumes() {
  echo "-v ${MAIL_DATA_DIR}:/var/mail -v ${MAIL_STATE_DIR}:/var/mail-state -v ${MAIL_CONFIG_DIR}:/tmp/docker-mailserver"
}

running_mail_container() {
  docker ps -q -f name="${STACK}_mailserver" | head -n1
}

run_setup() {
  local container
  container="$(running_mail_container)"
  if [ -n "$container" ]; then
    docker exec "$container" setup "$@"
  else
    # shellcheck disable=SC2046
    docker run --rm $(mail_volumes) "$MAIL_IMAGE" setup "$@"
  fi
}

cmd="${1:-}"
shift || true

case "$cmd" in
  add-user)
    EMAIL="${EMAIL:-${1:-}}"
    PASSWORD="${PASSWORD:-${2:-}}"
    if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
      echo "Usage: EMAIL=user@andiko.cloud PASSWORD=secret make prod-mail-add-user" >&2
      exit 1
    fi
    echo "Adding mailbox ${EMAIL} ..."
    run_setup email add "$EMAIL" "$PASSWORD"
    echo "Done."
    ;;
  update-password)
    EMAIL="${EMAIL:-${1:-}}"
    PASSWORD="${PASSWORD:-${2:-}}"
    if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
      echo "Usage: EMAIL=... PASSWORD=... bash infra/scripts/mail-setup.sh update-password" >&2
      exit 1
    fi
    run_setup email update "$EMAIL" "$PASSWORD"
    ;;
  delete-user)
    EMAIL="${EMAIL:-${1:-}}"
    if [ -z "$EMAIL" ]; then
      echo "Usage: EMAIL=... bash infra/scripts/mail-setup.sh delete-user" >&2
      exit 1
    fi
    run_setup email del "$EMAIL"
    ;;
  list-users)
    run_setup email list
    ;;
  dkim)
    echo "Generating DKIM config (if missing) ..."
    run_setup config dkim domain "${DOMAIN:-andiko.cloud}"
    echo ""
    echo "Publish this TXT record in DNS (mail._domainkey.${DOMAIN:-andiko.cloud}):"
    echo "---"
    if [ -f "${MAIL_CONFIG_DIR}/opendkim/keys/${DOMAIN:-andiko.cloud}/mail.txt" ]; then
      cat "${MAIL_CONFIG_DIR}/opendkim/keys/${DOMAIN:-andiko.cloud}/mail.txt"
    else
      find "${MAIL_CONFIG_DIR}" -name 'mail.txt' 2>/dev/null | head -n1 | xargs cat 2>/dev/null || \
        echo "(Key file not found yet — ensure mailserver has started once, then retry.)"
    fi
    echo "---"
    ;;
  logs)
    docker service logs -f "${STACK}_mailserver"
    ;;
  restart)
    docker service update --force "${STACK}_mailserver"
    echo "Restart triggered for ${STACK}_mailserver"
    ;;
  status)
    docker service ps "${STACK}_mailserver" --no-trunc
    container="$(running_mail_container)"
    if [ -n "$container" ]; then
      echo ""
      docker exec "$container" setup debug 2>/dev/null || docker exec "$container" postqueue -p 2>/dev/null || true
    fi
    ;;
  *)
    echo "Usage: mail-setup.sh {add-user|update-password|delete-user|list-users|dkim|logs|restart|status}" >&2
    exit 1
    ;;
esac
