#!/bin/sh
# One-shot WooCommerce dev bootstrap (wordpress:cli). Idempotent.
# Invoked as www-data after entrypoint-wrapper fixes volume permissions.
set -eu

WP_PATH=/var/www/html
OUTPUT="${WOO_CREDENTIALS_FILE:-/output/credentials.env}"

echo "[woo-init] Waiting for WordPress files..."
i=0
while [ ! -f "$WP_PATH/wp-config.php" ]; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "[woo-init] Timeout waiting for wp-config.php"
    exit 1
  fi
  sleep 2
done

cd "$WP_PATH"

echo "[woo-init] Waiting for database..."
i=0
while ! wp db check 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[woo-init] Database not ready"
    exit 1
  fi
  sleep 2
done

if ! wp core is-installed 2>/dev/null; then
  echo "[woo-init] Installing WordPress..."
  wp core install \
    --url="${WOO_STORE_URL:-http://localhost:8080}" \
    --title="Andiko Woo Dev" \
    --admin_user="${WOO_ADMIN_USER:-admin}" \
    --admin_password="${WOO_ADMIN_PASSWORD:-admin}" \
    --admin_email="${WOO_ADMIN_EMAIL:-admin@andiko.local}" \
    --skip-email
else
  echo "[woo-init] Updating WordPress core if needed..."
  wp core update 2>/dev/null || true
  wp core update-db 2>/dev/null || true
fi

if ! wp plugin is-active woocommerce 2>/dev/null; then
  echo "[woo-init] Installing WooCommerce..."
  wp plugin install woocommerce --activate
  wp wc tool run install_pages 2>/dev/null || true
fi

wp rewrite structure '/%postname%/' --hard 2>/dev/null || true
wp option update woocommerce_currency ARS 2>/dev/null || true
wp option update woocommerce_default_country AR:C 2>/dev/null || true
wp option update woocommerce_price_thousand_sep . 2>/dev/null || true
wp option update woocommerce_price_decimal_sep , 2>/dev/null || true

echo "[woo-init] Ensuring REST API credentials..."
mkdir -p "$(dirname "$OUTPUT")"
wp eval-file /scripts/create-api-key.php

echo "[woo-init] Done. Credentials: $OUTPUT"
cat "$OUTPUT"
