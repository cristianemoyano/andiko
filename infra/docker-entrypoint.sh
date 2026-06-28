#!/bin/sh
set -eu

if [ -f /run/secrets/database_url ]; then
  export DATABASE_URL="$(tr -d '\n' < /run/secrets/database_url)"
fi
if [ -f /run/secrets/auth_secret ]; then
  export AUTH_SECRET="$(tr -d '\n' < /run/secrets/auth_secret)"
fi
if [ -f /run/secrets/auth_url ]; then
  export AUTH_URL="$(tr -d '\n' < /run/secrets/auth_url)"
fi
if [ -f /run/secrets/cron_secret ]; then
  export CRON_SECRET="$(tr -d '\n' < /run/secrets/cron_secret)"
fi

exec "$@"
