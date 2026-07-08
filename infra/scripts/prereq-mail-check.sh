#!/usr/bin/env bash
# Validate DNS and port prerequisites before go-live (run on VPS or laptop).
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_common.sh
source "$SCRIPT_DIR/_common.sh" 2>/dev/null || true

DOMAIN="${DOMAIN:-andiko.cloud}"
MAIL_DOMAIN="${MAIL_DOMAIN:-mail.${DOMAIN}}"
VPS_IP="${VPS_IP:-187.77.235.70}"

pass=0
fail=0

check() {
  local name="$1"
  local ok="$2"
  if [ "$ok" = "1" ]; then
    echo "  OK   ${name}"
    pass=$((pass + 1))
  else
    echo "  FAIL ${name}"
    fail=$((fail + 1))
  fi
}

echo "==> Mail prerequisites check for ${DOMAIN}"
echo ""

echo "DNS A (${MAIL_DOMAIN}):"
a_record="$(dig +short A "$MAIL_DOMAIN" 2>/dev/null | head -n1 || true)"
if [ "$a_record" = "$VPS_IP" ]; then check "A record → ${VPS_IP}" 1; else check "A record → ${VPS_IP} (got: ${a_record:-none})" 0; fi

echo ""
echo "DNS MX (${DOMAIN}):"
mx_record="$(dig +short MX "$DOMAIN" 2>/dev/null | head -n1 || true)"
if echo "$mx_record" | grep -qi "$MAIL_DOMAIN"; then check "MX points to ${MAIL_DOMAIN}" 1; else check "MX points to ${MAIL_DOMAIN} (got: ${mx_record:-none})" 0; fi

echo ""
echo "DNS SPF:"
spf="$(dig +short TXT "$DOMAIN" 2>/dev/null | tr -d '\"' || true)"
if echo "$spf" | grep -qi 'v=spf1'; then check "SPF TXT present" 1; else check "SPF TXT present" 0; fi

echo ""
echo "DNS DMARC:"
dmarc="$(dig +short TXT "_dmarc.${DOMAIN}" 2>/dev/null | tr -d '\"' || true)"
if echo "$dmarc" | grep -qi 'v=DMARC1'; then check "DMARC TXT present" 1; else check "DMARC TXT present" 0; fi

echo ""
echo "DNS DKIM (optional until after first deploy):"
dkim="$(dig +short TXT "mail._domainkey.${DOMAIN}" 2>/dev/null | tr -d '\"' || true)"
if echo "$dkim" | grep -qi 'v=DKIM1'; then check "DKIM TXT present" 1; else check "DKIM TXT present (run make prod-mail-dkim after deploy)" 0; fi

echo ""
echo "PTR / rDNS (${VPS_IP}):"
ptr="$(dig +short -x "$VPS_IP" 2>/dev/null | sed 's/\.$//' || true)"
if echo "$ptr" | grep -qi "$MAIL_DOMAIN"; then check "PTR → ${MAIL_DOMAIN}" 1; else check "PTR → ${MAIL_DOMAIN} (got: ${ptr:-none}) — request in Hostinger panel" 0; fi

echo ""
echo "TCP ports on ${VPS_IP} (requires network access):"
for port in 25 587 993; do
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w3 "$VPS_IP" "$port" 2>/dev/null; then
      check "Port ${port} open" 1
    else
      check "Port ${port} open (blocked or service down)" 0
    fi
  else
    echo "  SKIP port ${port} (nc not installed)"
  fi
done

echo ""
echo "Result: ${pass} passed, ${fail} failed"
if [ "$fail" -gt 0 ]; then
  echo "See docs/deployment/mail-server.md for remediation."
  exit 1
fi
echo "All checks passed."
