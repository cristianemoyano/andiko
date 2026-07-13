# Production deployment (VPS)

Andiko production runs on a single VPS at **https://andiko.cloud** using Docker Swarm, nginx, Certbot, and PostgreSQL with a persistent volume. Image builds are pushed manually to GHCR (no GitHub Actions).

**Portainer CE** is installed on the same VPS: **https://portainer.andiko.cloud** (HTTPS + nginx basic auth + Portainer admin login).

The **production VPS is already configured** (Swarm, secrets, TLS, nginx, Portainer, backups). Day-to-day work is **deploying releases** — not re-running bootstrap.

Vercel staging and Hostinger production operate **independently**. Staging validates integrations on every merge to `develop`; production is promoted manually via GHCR images (see [Deploy a release](#deploy-a-release)).

## Environments

| Environment | Platform | URL / acceso | Uso |
|-------------|----------|--------------|-----|
| **Staging** | Vercel | Preview / proyecto Vercel ligado al repo | CI visual, QA pre-release, demos internas |
| **Production** | Hostinger VPS (Debian) | **https://andiko.cloud** | Clientes beta y operación real |

Production stack details below. Vercel env vars and VPS `infra/.env.production` are **not** shared — configure each environment separately.

## Architecture

```
Internet → nginx (:443) → app (:3000) → postgres (:5432, internal)
                ├→ portainer (:9000, UI at portainer.andiko.cloud)
                ├→ umami (:3000, analytics.andiko.cloud)
                ├→ cap (:3000, cap.andiko.cloud) → cap_valkey (in-memory)
                ├→ umami_db (PostgreSQL, internal)
                ├→ mailserver (:25/:587/:993, mail.andiko.cloud)
                ↑
           Certbot (Let's Encrypt)
```

| Service   | Replicas | Role                          |
|-----------|----------|-------------------------------|
| `nginx`   | 1        | TLS termination, reverse proxy |
| `app`     | 1        | Next.js standalone (`node server.js`) |
| `postgres`| 1        | PostgreSQL 16, bind-mounted volume   |
| `portainer` | 1      | Docker Swarm UI (basic auth + HTTPS) |
| `umami`   | 1        | Self-hosted pageview analytics |
| `umami_db`| 1        | PostgreSQL 16 for Umami data |
| `cap`     | 1        | Self-hosted invisible CAPTCHA |
| `cap_valkey` | 1     | Ephemeral challenge store (in-memory) |
| `mailserver` | 1     | Postfix + Dovecot + DKIM ([mail-server.md](mail-server.md)) |

All orgs (multi-tenant) share one app instance and one database.

**Email:** self-hosted `@andiko.cloud` via docker-mailserver. Full setup: **[mail-server.md](mail-server.md)**.

## Production VPS (live)

| Item | Value |
|------|--------|
| Status | **Configured** — bootstrap, SSL, and Portainer already done |
| SSH | `ssh root@187.77.235.70` |
| Hostname | `srv1789017` |
| Repo path | `/root/andiko` |
| Branch | `develop` |
| App | [https://andiko.cloud](https://andiko.cloud) |
| Portainer | [https://portainer.andiko.cloud](https://portainer.andiko.cloud) |
| GHCR image | `ghcr.io/cristianemoyano/andiko` |
| Swarm stack | `andiko` |
| Current tag | `v0.35.0` — usar el valor de `package.json` / último tag en GitHub Releases |

`infra/.env.production` on the VPS holds secrets — never commit it. See [Environment file](#environment-file) when editing or provisioning a new host.

## Deploy a release (routine)

From the **VPS** — one command does everything:

```bash
ssh root@187.77.235.70
cd /root/andiko
make prod-release
```

`prod-release` runs in order:

1. `git pull origin develop` (+ sync nginx configs if needed)
2. Build and push image to GHCR (`prod-push`)
3. **Migrations** (`prod-migrate`) — before deploy so the DB matches the new app
4. **App-only rolling update** (`prod-deploy-app`) — updates `andiko_app` image only; does **not** redeploy postgres, nginx, or mailserver
5. Health check (`https://andiko.cloud/api/health`)

Prompts for the tag interactively (default from `package.json`). Override when needed:

```bash
make prod-release TAG=v0.35.0
make prod-release TAG=v0.35.0 SKIP_PUSH=1    # image already in GHCR (e.g. pushed from laptop)
make prod-release TAG=v0.35.0 SKIP_PULL=1    # code already up to date on VPS
make prod-release TAG=v0.35.0 SKIP_MIGRATE=1  # no migration files in this release
```

**Verify after deploy:**

```bash
make prod-health
docker stack services andiko
```

Monitor services and logs in Portainer: [https://portainer.andiko.cloud](https://portainer.andiko.cloud)

### App deploy vs infra deploy

Routine ERP releases should **only** touch the app container. Infra services (postgres, nginx, mailserver, portainer) change rarely and carry more blast radius if redeployed together with the app.

| Command | Scope | Cuándo usarlo |
|---------|--------|----------------|
| `make prod-deploy-app TAG=…` | Solo `andiko_app` (rolling `docker service update`) | **Releases de ERP** (default en `prod-release`) |
| `make prod-deploy-infra TAG=…` | Stack completo (`docker stack deploy`) | Cambios en `docker-stack.yml`, mail, nginx, nuevos servicios |
| `make prod-mail-restart` | Solo mailserver | Cambios en `docker-mailserver.env` |
| `make prod-secrets` | Secrets + rolling restart de servicios afectados | Rotación de credenciales (sin `stack rm`) |
| `make prod-sync-db-password` | Postgres `ALTER USER` + restart app | Incidente `db: disconnected` |

**Regla:** si el cambio es solo código del ERP → `prod-release` o `prod-deploy-app`. Si el cambio es infra → `prod-deploy-infra` (y migraciones/scripts específicos si aplica). Nunca usar `docker stack rm` para rotar secrets o publicar una versión nueva de la app.

### Zero-downtime en releases de app

Objetivo: **cada release de ERP no debe cortar tráfico**.

| Mecanismo | Dónde |
|-----------|--------|
| `prod-release` → `prod-deploy-app` | Solo actualiza `andiko_app`; postgres/nginx/mail/portainer siguen corriendo |
| `update_config.order: start-first` | `infra/docker-stack.yml` — Swarm levanta el contenedor nuevo antes de bajar el viejo |
| `failure_action: rollback` | Si el nuevo contenedor no pasa healthcheck, Swarm revierte solo |
| Healthcheck en app | `wget` a `/api/health` antes de converger el rolling update |

`prod-deploy-infra` (`docker stack deploy`) puede reiniciar servicios del stack y **no** es el camino para releases rutinarios. Usarlo solo cuando cambia `docker-stack.yml`, puertos, mail o un servicio nuevo.

### Manual deploy (advanced)

If you need to run steps separately:

```bash
# Laptop (optional — prod-release can build/push from VPS)
make prod-push TAG=v0.35.0

# VPS — routine app release
cd /root/andiko && git pull origin develop
make prod-migrate TAG=v0.35.0
make prod-deploy-app TAG=v0.35.0
make prod-health

# VPS — infra change (stack yaml, mail ports, new service)
make prod-deploy-infra TAG=v0.35.0
```

`make prod-deploy-app` does **not** run migrations. Never skip `prod-migrate` when migration files changed.

---

## Reference: prerequisites & environment

The live VPS already satisfies the items below. Use this section when **editing secrets** or provisioning a **new host**.

### Prerequisites

**Target host:** Hostinger VPS running **Debian** (production at `andiko.cloud`).

- Docker Engine 27+ with Swarm (`docker swarm init`)
- System packages (Debian):

```bash
sudo apt update
sudo apt install -y make git curl gettext-base
```

- DNS: `andiko.cloud`, `www.andiko.cloud`, and `portainer.andiko.cloud` → VPS public IP (Hostinger DNS or external)
- Firewall: allow TCP 22, 80, 443 — and for mail: 25, 587, 465, 993 — check **both** Hostinger panel firewall and `ufw` on the server if enabled
- GitHub PAT:
  - **Laptop:** `write:packages` (push images to GHCR)
  - **VPS:** `read:packages` (pull images)

### Environment file

```bash
cp infra/.env.production.example infra/.env.production
# Edit secrets — never commit infra/.env.production
```

Generate secrets (prefer **hex** for `POSTGRES_PASSWORD` — URL-safe, no encoding issues):

```bash
openssl rand -hex 32      # POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET (recommended)
# openssl rand -base64 32 # OK for AUTH_SECRET/CRON_SECRET; encode password in DATABASE_URL if used for Postgres
```

Set `POSTGRES_PASSWORD` in `.env.production`; scripts build `DATABASE_URL` automatically from `POSTGRES_*` (URL-encoded). You do **not** need to hand-edit `DATABASE_URL` if `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match.

| Variable | Purpose |
|----------|---------|
| `GHCR_IMAGE` | `ghcr.io/cristianemoyano/andiko` |
| `POSTGRES_*` | Database credentials |
| `DATABASE_URL` | Optional if `POSTGRES_*` set; host must be `postgres` |
| `AUTH_URL` | `https://andiko.cloud` |
| `AFIP_MODE` | `produccion` on VPS |
| `CERTBOT_EMAIL` | Let's Encrypt notifications |
| `BACKUP_GDRIVE_*` | rclone remote for off-site backups |
| `NEXT_PUBLIC_POSTHOG_*` | PostHog analytics (build + runtime); see `infra/.env.production.example` |
| `MAIL_*` | docker-mailserver paths and env file; see [mail-server.md](mail-server.md) |

Values with spaces must be quoted in `infra/.env.production`, e.g. `BACKUP_GDRIVE_FOLDER="my folder"`.

---

## New VPS bootstrap (first time only)

Use this section only when provisioning a **fresh** Debian VPS. The live Hostinger server is already past these steps.

### Before touching the VPS

1. **DNS:** `andiko.cloud`, `www.andiko.cloud`, and `portainer.andiko.cloud` → VPS public IP.
2. **Firewall:** TCP **22**, **80**, **443** (Hostinger panel + `ufw` if enabled).
3. **GitHub PAT (laptop):** `write:packages` + `read:packages` → push images.
4. **GitHub PAT (VPS):** `read:packages` → pull images.

### Bootstrap del sistema

```bash
ssh root@YOUR_VPS_IP
apt-get update && apt-get install -y git
git clone git@github.com:cristianemoyano/andiko.git /root/andiko
cd /root/andiko && git checkout develop
sudo bash infra/scripts/bootstrap-vps.sh
```

If the repo is private and `git clone` fails, add an SSH deploy key on the VPS (`ssh-keygen -t ed25519`, add public key to GitHub).

`bootstrap-vps.sh` installs git, make, curl, Docker, `ufw`, and runs `docker swarm init`.

### Configurar Andiko

```bash
cd /root/andiko
cp infra/.env.production.example infra/.env.production
nano infra/.env.production
```

Generate secrets:

```bash
openssl rand -hex 32   # POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET (recommended)
```

Complete `infra/.env.production`: `POSTGRES_*`, `AUTH_URL=https://andiko.cloud`, `AFIP_MODE=produccion`, `CERTBOT_EMAIL`, `GHCR_IMAGE`.

GHCR login on VPS (read-only PAT):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u cristianemoyano --password-stdin
```

### Deploy inicial

```bash
make prod-init
make prod-portainer-auth          # Portainer nginx basic auth
make prod-deploy-infra TAG=vX.Y.Z  # first image — build/push from laptop or VPS
make prod-migrate TAG=vX.Y.Z
make prod-health                  # HTTP (before certificate)
make prod-ssl                     # HTTPS + portainer.andiko.cloud in cert
make prod-health                  # https://andiko.cloud/api/health
```

If the cert already exists but lacks `portainer.andiko.cloud`:

```bash
bash infra/scripts/expand-ssl-portainer.sh
```

### Verificar

```bash
docker stack services andiko
curl -sf https://andiko.cloud/api/health
curl -sf -u admin:YOUR_BASIC_AUTH_PASSWORD https://portainer.andiko.cloud/api/status
```

### Cron (recommended on new VPS)

```cron
0 3,15 * * * cd /root/andiko && make prod-renew-certs >> /var/log/andiko-certbot.log 2>&1
0 2 * * * cd /root/andiko && make prod-backup >> /var/log/andiko-backup.log 2>&1
```

After bootstrap, use [Deploy a release (routine)](#deploy-a-release-routine) for every subsequent version.

---

## Makefile reference

| Target | Where | When | Description |
|--------|-------|------|-------------|
| **`prod-release`** | **VPS** | **Routine** | Pull, push image, migrate, **app deploy**, health |
| `prod-push TAG=…` | Laptop / VPS | Release | Build + push Docker image to GHCR |
| `prod-deploy-app TAG=…` | VPS | **Routine** | Rolling update of `andiko_app` only |
| `prod-deploy-infra TAG=…` | VPS | Infra changes | Full `docker stack deploy` |
| `prod-deploy TAG=…` | VPS | Infra (alias) | Same as `prod-deploy-infra` |
| `prod-migrate TAG=…` | VPS | Advanced | Run pending Umzug migrations |
| `prod-health` | VPS | After deploy | `curl https://andiko.cloud/api/health` |
| `prod-logs` | VPS | Ops | Follow app service logs |
| `prod-backup` | VPS | Cron / ops | pg_dump + optional rclone → Google Drive |
| `prod-disk-check` | VPS | Ops | Host + Docker + Andiko data disk report |
| `prod-prune` | VPS | Ops | Safe Docker cleanup (cache, stopped containers, old app images) |
| `prod-renew-certs` | VPS | Cron | Renew TLS certificates |
| `prod-sync-nginx-conf` | VPS | Rare | Re-apply nginx templates to live dir |
| `prod-migrate-status TAG=…` | VPS | Debug | List executed vs pending migrations |
| `prod-create-sysadmin TAG=… EMAIL=… PASSWORD=…` | VPS | Once / ops | Create or reset platform sys-admin user |
| `prod-bootstrap-vps` | VPS | **Once (new VPS)** | Install Docker, git, make, ufw, swarm init |
| `prod-init` | VPS | **Once (new VPS)** | Swarm secrets, data dirs, nginx bootstrap |
| `prod-secrets` | VPS | Rare | Rotate Swarm secrets in place (rolling update; no stack rm) |
| `prod-sync-db-password` | VPS | Incident | Sync Postgres password from `.env` + restart app only |
| `prod-ssl` | VPS | **Once (new VPS)** | Certbot certificate + enable HTTPS |
| `prod-expand-ssl-services` | VPS | Once / new SANs | Expand cert for analytics.andiko.cloud + cap.andiko.cloud |
| `prod-purge-umami` | VPS | Weekly cron | Delete Umami analytics older than `UMAMI_RETENTION_DAYS` (90) |

## Manual migrations

Included in `make prod-release`. Run standalone only when debugging or using [manual deploy](#manual-deploy-advanced):

```bash
make prod-migrate TAG=v0.35.0
make prod-migrate-status TAG=v0.35.0
```

Emergency fallback: `POST /api/admin/migrate` with `Authorization: Bearer $MIGRATION_SECRET` if configured.

## Platform sys-admin

Create the first sys-admin (or reset password) on the VPS:

```bash
make prod-create-sysadmin \
  TAG=v0.35.0 \
  EMAIL=admin@andiko.cloud \
  PASSWORD='your-secure-password-min-16-chars' \
  NAME='Sys Admin'
```

`PASSWORD` must be at least 16 characters. If the email already exists, the user is updated to `sys-admin` with the new password. Login at `https://andiko.cloud/login`.

Generate a password: `openssl rand -base64 24`

## SSL / Certbot

- **Initial:** `make prod-ssl` (requires port 80 reachable for ACME webroot)
- **Renewal cron** (twice daily):

```cron
0 3,15 * * * cd ~/andiko && make prod-renew-certs >> /var/log/andiko-certbot.log 2>&1
```

HTTP bootstrap configs live in **`infra/nginx/conf.d/`** (tracked in git for new VPS setups). At runtime, nginx mounts **`/var/lib/andiko/nginx/conf.d`** — `sync-nginx-conf.sh` copies the bootstrap there on first deploy. After `prod-ssl`, HTTPS configs are written to the live dir from `infra/nginx/templates/*.ssl.conf`.

`git pull` does not overwrite live nginx configs. `make prod-deploy` and `make prod-release` run `sync-nginx-conf.sh` to bootstrap or upgrade when needed. To re-apply templates manually:

```bash
FORCE_NGINX_SSL=1 make prod-sync-nginx-conf
```

New installs request a certificate that includes `portainer.andiko.cloud`. On a VPS that already has HTTPS without that SAN, run once:

```bash
bash infra/scripts/expand-ssl-portainer.sh
```

For **Umami** (`analytics.andiko.cloud`) and **Cap** (`cap.andiko.cloud`), add DNS A records to the VPS IP, then:

```bash
make prod-deploy-infra TAG=vX.Y.Z   # first time: adds umami, umami_db, cap, cap_valkey
make prod-expand-ssl-services
```

### Umami + Cap first-time setup

1. Set in `infra/.env.production` (see `infra/.env.production.example`):
   - `UMAMI_APP_SECRET`, `UMAMI_POSTGRES_PASSWORD` (`openssl rand -hex 32`)
   - `CAP_ADMIN_KEY` (`openssl rand -hex 32`)
2. `make prod-init` (or `make prod-secrets` if rotating) to create Swarm secret `cap_secret` from `CAP_SECRET_KEY`
3. After deploy, open **https://analytics.andiko.cloud** — change default `admin` / `umami` password, create a website, copy `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
4. Open **https://cap.andiko.cloud** — log in with `CAP_ADMIN_KEY`, create a site key → `NEXT_PUBLIC_CAP_SITE_KEY` + `CAP_SECRET_KEY`
5. Update env vars, `make prod-push TAG=…` and `make prod-deploy-app TAG=…`
6. **Vercel staging:** do **not** set Cap env vars — Cap is disabled on Vercel (`VERCEL=1`). Set `WEB3FORMS_ACCESS_KEY` only if contact form should work on staging.

**Umami retention:** analytics older than **90 days** are purged weekly:

```cron
0 4 * * 0 cd /root/andiko && make prod-purge-umami >> /var/log/andiko-umami-purge.log 2>&1
```

**Local dev** (optional): `docker compose --profile analytics up -d` — Umami on `:3001`, Cap on `:3002`. Enable with `NEXT_PUBLIC_UMAMI_DEV=true` / `NEXT_PUBLIC_CAP_DEV=true` in `.env.local`.

## Container logs

Each Swarm service uses the Docker **`local`** log driver with rotation (`max-size: 50m`, `max-file: 5` — about 250 MB per container). Logs live under `/var/lib/docker/containers/` on the host.

View logs:

```bash
make prod-logs
docker service logs andiko_nginx --tail 100
docker service logs andiko_portainer --tail 100
```

Advanced host retention (logrotate for cron files) is tracked in [`docs/ROADMAP.md`](../ROADMAP.md). Docker cleanup: `make prod-prune`.

## Disk diagnostics

Portainer CE does not show VPS disk usage in the Swarm visualizer. On the VPS:

```bash
make prod-disk-check
```

Reports root filesystem usage, `/var/lib/andiko/*` sizes, `docker system df`, old images, and stopped containers. Exits with code **2** (warning) at ≥85% disk, **1** (critical) at ≥95% — override with `DISK_WARN_PCT` / `DISK_CRIT_PCT` in the environment.

```bash
DISK_WARN_PCT=80 DISK_CRIT_PCT=90 make prod-disk-check
```

## Safe disk cleanup (`prod-prune`)

Reclaims Docker build cache, stopped task containers, dangling layers, and **old Andiko release images** not used by the running `andiko_app` service.

```bash
# Preview what would be removed
make prod-prune PRUNE_DRY_RUN=1

# Apply (safe defaults)
make prod-prune

# Also wipe all unused build cache (~tens of GB if builds ran on VPS)
make prod-prune PRUNE_BUILDER_ALL=1
```

**Never prunes:** Postgres/mail/certs data under `/var/lib/andiko`, Docker volumes, or the image currently deployed on `andiko_app`.

**After prune:**

```bash
docker stack services andiko
make prod-health
```

Optional monthly cron (conservative):

```cron
0 4 1 * * cd /root/andiko && make prod-prune >> /var/log/andiko-prune.log 2>&1
```

## Portainer (Swarm UI)

**Live:** [https://portainer.andiko.cloud](https://portainer.andiko.cloud) — Portainer CE 2.21.5 (`andiko_portainer`). Already installed and configured on the production VPS.

The Swarm **cluster visualizer** shows nodes and tasks only — it does **not** display host disk usage. Use `make prod-disk-check` on the VPS (or SSH + `df -h`) for disk diagnostics.

Web UI to monitor Docker Swarm (services, logs, images, volumes). **Not exposed on port 9000** — only via nginx on the subdomain above.

**Security layers:**

1. HTTPS (Let's Encrypt)
2. nginx **basic auth** (htpasswd on the VPS, not in git)
3. Portainer admin login

Portainer mounts `/var/run/docker.sock` on the manager node — full Docker control. Treat credentials accordingly.

Verify:

```bash
curl -sf -u admin:YOUR_BASIC_AUTH_PASSWORD https://portainer.andiko.cloud/api/status
docker service inspect andiko_portainer --format '{{json .Spec.TaskTemplate.LogDriver}}'
```

Portainer **initial setup** (DNS, `prod-portainer-auth`, TLS SAN) is documented under [New VPS bootstrap](#new-vps-bootstrap-first-time-only).

## Backups

```bash
make prod-backup
```

1. `pg_dump` → gzip → `/var/lib/andiko/backups/`
2. Optional `age` encryption (`BACKUP_ENCRYPT=yes`)
3. Upload via `rclone` to Google Drive (`BACKUP_GDRIVE_REMOTE`)

**One-time rclone setup (Debian):**

```bash
sudo apt install -y rclone
rclone config   # create remote named "gdrive"
```

**Backup cron:**

```cron
0 2 * * * cd ~/andiko && make prod-backup >> /var/log/andiko-backup.log 2>&1
```

**Restore (outline):**

```bash
gunzip -c /var/lib/andiko/backups/andiko-YYYYMMDD-HHMMSS.sql.gz | \
  docker exec -i $(docker ps -q -f name=andiko_postgres) psql -U andiko -d andiko
```

Test restores quarterly. Do not store backups in GitHub.

## Other cron jobs

**Billing dunning** (if `CRON_SECRET` is set):

```cron
0 6 * * * curl -sf -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://andiko.cloud/api/v1/sys-admin/billing/jobs/dunning
```

**Billing invoice automation** (generates draft invoices for subscriptions with an ended
period, when enabled under `/sys-admin/billing/automatizacion`; if `CRON_SECRET` is set).
Run every minute — the job no-ops when disabled or not due:

```cron
* * * * * curl -sf -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://andiko.cloud/api/v1/sys-admin/billing/jobs/generate-due-invoices
```

**Automations tick** (drives every org's `scheduled_tasks` — the recurring task/automation
scheduler behind `/automatizaciones`; if `CRON_SECRET` is set):

```cron
* * * * * curl -sf -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://andiko.cloud/api/v1/sys-admin/jobs/automations-tick
```

Or install it with `make prod-install-automations-cron` (reads `DOMAIN` and `CRON_SECRET`
from `infra/.env.production`, idempotent — re-running updates the entry in place instead of
duplicating it). Remove it with `make prod-remove-automations-cron`.

One minute is the practical floor for automation schedules — a cron expression can't fire more
often than this endpoint is polled. Calling it concurrently is safe by design (an automation's
`next_run_at` is claimed with optimistic concurrency, so overlapping ticks — e.g. one run taking
longer than 60s, or accidentally installing this crontab entry on more than one host — never
process the same task twice); no `flock` or other host-side locking is needed.

## POS clients

Point each terminal's `cloud_url` to `https://andiko.cloud`.

## Troubleshooting

### Incident: 502 / `db: disconnected` (password drift)

**Symptom:** nginx 502, `andiko_app` 0/1, `/api/health` → `503` with `"db":"disconnected"`.

**Cause:** PostgreSQL role password no longer matches `DATABASE_URL` in the Swarm secret (e.g. `.env` edited without syncing DB, or secret rotated without `ALTER USER`).

**Do not** run `docker stack rm andiko` for this — that causes unnecessary downtime.

**Recovery (zero/minimal downtime):**

```bash
# On VPS — sync DB password from infra/.env.production and restart app only
make prod-sync-db-password

# If health still fails, secrets may differ from .env (rolling update, no stack rm):
make prod-secrets
curl -sf https://andiko.cloud/api/health
```

**Prevention:** keep `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `infra/.env.production` as the single source of truth; scripts build `DATABASE_URL` with URL-encoding. After changing password, run `make prod-sync-db-password` or `make prod-secrets` — never hand-edit only one of DB / secret / `.env`.

| Symptom | Check |
|---------|-------|
| **`DATABASE_URL: Invalid URL` on migrate** | Password contains `+`, `/`, `=` from base64 — use `openssl rand -hex 32` for `POSTGRES_PASSWORD`, or `git pull` and re-run `make prod-secrets` + `make prod-deploy` (scripts now URL-encode) |
| **`error from registry: denied` on push** | PAT missing `write:packages`; re-login with GitHub **username** (not email); `GHCR_IMAGE` owner must match PAT owner; authorize SSO on org if applicable |
| `prod-deploy` fails pulling image | `docker login ghcr.io` on VPS; image tag exists |
| Stack not starting | `docker stack ps andiko --no-trunc` |
| Health check fails | `docker service logs andiko_app`; postgres healthy? |
| Migrations fail | `make prod-migrate-status TAG=…`; DATABASE_URL host is `postgres` |
| SSL fails | DNS points to VPS; port 80 open; `CERTBOT_EMAIL` set |
| Portainer 401/403 | Run `make prod-portainer-auth`; redeploy; expand cert if HTTPS fails |
| Portainer **500** after basic-auth prompt | `.htpasswd` not readable by nginx — `chmod 644 /var/lib/andiko/portainer/.htpasswd` or re-run `make prod-portainer-auth` |
| Portainer nginx error | `PORTAINER_HTPASSWD_FILE` must exist before deploy |
| Secrets changed | `make prod-secrets` (rolling); verify health; redeploy only if image changed |

## Scaling note

v1 uses **one app replica** on one VPS. Vertical scaling (more CPU/RAM) is preferred before adding replicas. Multi-replica horizontal scaling is a future option if traffic requires it.
