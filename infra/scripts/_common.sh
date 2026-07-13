#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)"
fi

ENV_FILE="${REPO_ROOT}/infra/.env.production"

load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "Missing $ENV_FILE — copy infra/.env.production.example and fill in values." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

require_tag() {
  if [ -z "${TAG:-}" ]; then
    echo "TAG is required (e.g. make prod-deploy TAG=v0.26.0)" >&2
    exit 1
  fi
  export IMAGE_TAG="$TAG"
}

latest_git_tag() {
  git -C "$REPO_ROOT" tag --sort=-version:refname 'v*' 2>/dev/null | head -n1
}

package_json_tag() {
  local version
  if command -v python3 >/dev/null 2>&1; then
    version="$(python3 -c "import json; print(json.load(open('${REPO_ROOT}/package.json'))['version'])" 2>/dev/null)" || true
  elif command -v node >/dev/null 2>&1; then
    version="$(node -p "require('${REPO_ROOT}/package.json').version" 2>/dev/null)" || true
  else
    return 1
  fi
  [ -n "${version:-}" ] || return 1
  echo "v${version}"
}

normalize_tag() {
  local t="${1#"${1%%[![:space:]]*}"}"
  t="${t%"${t##*[![:space:]]}"}"
  if [ -z "$t" ]; then
    return 1
  fi
  case "$t" in
    v*) echo "$t" ;;
    [0-9]*) echo "v$t" ;;
    *) echo "$t" ;;
  esac
}

# Interactive tag picker for prod-release when TAG is unset.
resolve_release_tag() {
  if [ -n "${TAG:-}" ]; then
    TAG="$(normalize_tag "$TAG")" || {
      echo "Invalid TAG: ${TAG:-}" >&2
      exit 1
    }
    export IMAGE_TAG="$TAG"
    return
  fi

  if [ ! -t 0 ]; then
    echo "TAG is required in non-interactive mode (make prod-release TAG=v0.32.0)" >&2
    exit 1
  fi

  local suggested git_tag pkg_tag reply source
  git_tag="$(latest_git_tag || true)"
  pkg_tag="$(package_json_tag || true)"

  if [ -n "$pkg_tag" ]; then
    suggested="$pkg_tag"
    source="package.json"
  elif [ -n "$git_tag" ]; then
    suggested="$git_tag"
    source="latest git tag"
  else
    suggested=""
    source=""
  fi

  echo ""
  echo "Release tag"
  if [ -n "$suggested" ]; then
    echo "  Suggested: ${suggested} (from ${source})"
    [ -n "$git_tag" ] && [ "$git_tag" != "$suggested" ] && echo "  Latest git tag: ${git_tag}"
    printf "Press Enter to use %s, or type another tag: " "$suggested"
    read -r reply
    if [ -z "$reply" ]; then
      TAG="$suggested"
    else
      TAG="$reply"
    fi
  else
    echo "Could not detect a release tag (package.json / git tags)." >&2
    printf "Enter release tag (e.g. v0.32.0): "
    read -r TAG
    if [ -z "$TAG" ]; then
      echo "Aborted: tag is required." >&2
      exit 1
    fi
  fi

  TAG="$(normalize_tag "$TAG")" || {
    echo "Invalid or empty tag." >&2
    exit 1
  }
  export TAG IMAGE_TAG="$TAG"
  echo "Using tag: ${TAG}"
  echo ""
}

stack_name() {
  echo "${STACK_NAME:-andiko}"
}

internal_network() {
  echo "$(stack_name)_internal"
}

# Build a valid PostgreSQL URL (percent-encode user/password for special chars in openssl base64).
build_database_url() {
  local user="${1:?user}"
  local password="${2:?password}"
  local host="${3:-postgres}"
  local port="${4:-5432}"
  local db="${5:?db}"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required to build DATABASE_URL (apt install python3)." >&2
    exit 1
  fi

  export POSTGRES_USER="$user" POSTGRES_PASSWORD="$password" POSTGRES_HOST="$host" POSTGRES_PORT="$port" POSTGRES_DB="$db"
  python3 <<'PY'
import os
import urllib.parse

u = os.environ["POSTGRES_USER"]
p = os.environ["POSTGRES_PASSWORD"]
h = os.environ["POSTGRES_HOST"]
port = os.environ["POSTGRES_PORT"]
d = os.environ["POSTGRES_DB"]
print(
    "postgresql://"
    f"{urllib.parse.quote(u, safe='')}:{urllib.parse.quote(p, safe='')}"
    f"@{h}:{port}/{urllib.parse.quote(d, safe='')}"
)
PY
}

# Prefer POSTGRES_* (encoded) over a raw DATABASE_URL line in .env.production.
resolve_database_url() {
  if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    build_database_url "$POSTGRES_USER" "$POSTGRES_PASSWORD" "postgres" "5432" "$POSTGRES_DB"
  elif [ -n "${DATABASE_URL:-}" ]; then
    echo "$DATABASE_URL"
  else
    echo "Set POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB (or DATABASE_URL) in infra/.env.production" >&2
    exit 1
  fi
}

CAP_SECRET_PLACEHOLDER='cap-secret-not-configured'

# Swarm stack requires external secret cap_secret — create placeholder until Cap dashboard is configured.
ensure_cap_secret() {
  if docker secret inspect cap_secret >/dev/null 2>&1; then
    return 0
  fi
  local value="${CAP_SECRET_KEY:-}"
  if [ -z "$value" ]; then
    echo "Warning: CAP_SECRET_KEY unset — creating placeholder cap_secret (Cap disabled until you run make prod-secrets)." >&2
    value="$CAP_SECRET_PLACEHOLDER"
  fi
  echo -n "$value" | docker secret create cap_secret -
  echo "Created secret cap_secret"
}

ensure_umami_data_dir() {
  local dir="${UMAMI_DATA_DIR:-/var/lib/andiko/umami-db}"
  if [ ! -d "$dir" ]; then
    echo "Creating ${dir} for umami_db bind mount ..."
    sudo mkdir -p "$dir"
    sudo chmod 755 "$dir"
  fi
}

validate_umami_cap_env() {
  local missing=0
  if [ -z "${UMAMI_POSTGRES_PASSWORD:-}" ]; then
    echo "Error: UMAMI_POSTGRES_PASSWORD is empty in infra/.env.production" >&2
    missing=1
  fi
  if [ -z "${UMAMI_APP_SECRET:-}" ]; then
    echo "Error: UMAMI_APP_SECRET is empty in infra/.env.production" >&2
    missing=1
  fi
  if [ -z "${CAP_ADMIN_KEY:-}" ]; then
    echo "Error: CAP_ADMIN_KEY is empty in infra/.env.production" >&2
    missing=1
  fi
  if [ "$missing" -ne 0 ]; then
    echo "Generate values: openssl rand -hex 32" >&2
    exit 1
  fi
}
