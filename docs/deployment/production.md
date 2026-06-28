# Production deployment (VPS)

Andiko production runs on a single VPS at **https://andiko.cloud** using Docker Swarm, nginx, Certbot, and PostgreSQL with a persistent volume. Migrations are **manual** after each deploy. Image builds are pushed manually to GHCR from your laptop (no GitHub Actions).

Vercel configuration is unchanged and operates independently of this stack.

## Architecture

```
Internet → nginx (:443) → app (:3000) → postgres (:5432, internal)
                ↑
           Certbot (Let's Encrypt)
```

| Service   | Replicas | Role                          |
|-----------|----------|-------------------------------|
| `nginx`   | 1        | TLS termination, reverse proxy |
| `app`     | 1        | Next.js standalone (`node server.js`) |
| `postgres`| 1        | PostgreSQL 16, bind-mounted volume   |

All orgs (multi-tenant) share one app instance and one database.

## Prerequisites

**Target host:** Hostinger VPS running **Debian** (production at `andiko.cloud`).

- Docker Engine 27+ with Swarm (`docker swarm init`)
- System packages (Debian):

```bash
sudo apt update
sudo apt install -y make git curl gettext-base
```

- DNS: `andiko.cloud` and `www.andiko.cloud` → VPS public IP (Hostinger DNS or external)
- Firewall: allow TCP 22, 80, 443 — check **both** Hostinger panel firewall and `ufw` on the server if enabled
- GitHub PAT:
  - **Laptop:** `write:packages` (push images to GHCR)
  - **VPS:** `read:packages` (pull images)

## Environment file

```bash
cp infra/.env.production.example infra/.env.production
# Edit secrets — never commit infra/.env.production
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET, CRON_SECRET, POSTGRES_PASSWORD
```

| Variable | Purpose |
|----------|---------|
| `GHCR_IMAGE` | e.g. `ghcr.io/cristianemoyano/andiko` |
| `POSTGRES_*` | Database credentials |
| `DATABASE_URL` | Must use host `postgres` (swarm service name) |
| `AUTH_URL` | `https://andiko.cloud` |
| `AFIP_MODE` | `produccion` on VPS |
| `CERTBOT_EMAIL` | Let's Encrypt notifications |
| `BACKUP_GDRIVE_*` | rclone remote for off-site backups |

## First-time bootstrap

Clone anywhere on the VPS (e.g. `~/andiko`):

```bash
git clone git@github.com:cristianemoyano/andiko.git ~/andiko
cd ~/andiko
cp infra/.env.production.example infra/.env.production
# edit infra/.env.production

echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
make prod-init
```

On your **laptop** (same repo, Docker running):

```bash
make prod-push TAG=v0.26.0
```

Back on the **VPS**:

```bash
make prod-deploy TAG=v0.26.0
make prod-migrate TAG=v0.26.0
make prod-health   # HTTP until SSL — uses default nginx config
make prod-ssl      # Certbot + HTTPS nginx config
make prod-health   # HTTPS
```

## Release workflow

Each release:

```bash
# Laptop
make prod-push TAG=v0.27.0

# VPS
git pull
make prod-deploy TAG=v0.27.0
make prod-migrate TAG=v0.27.0
make prod-health
```

`make prod-deploy` prints a reminder to run migrations. **Never skip `prod-migrate`** when migration files changed.

## Makefile reference

| Target | Where | Description |
|--------|-------|-------------|
| `prod-push TAG=…` | Laptop | Build + push Docker image to GHCR |
| `prod-init` | VPS (once) | Swarm init, data dirs, Docker secrets |
| `prod-secrets` | VPS | Rotate Swarm secrets (then redeploy) |
| `prod-deploy TAG=…` | VPS | Pull image + `docker stack deploy` |
| `prod-ssl` | VPS (once) | Certbot certificate + enable HTTPS |
| `prod-migrate TAG=…` | VPS | Run pending Umzug migrations |
| `prod-migrate-status TAG=…` | VPS | List executed vs pending migrations |
| `prod-health` | VPS | `curl https://andiko.cloud/api/health` |
| `prod-backup` | VPS | pg_dump + optional rclone → Google Drive |
| `prod-logs` | VPS | Follow app service logs |
| `prod-renew-certs` | VPS (cron) | Renew TLS certificates |

## Manual migrations

Migrations do **not** run during Docker build or deploy. The migrate container uses the same image tag as the deployed app:

```bash
make prod-migrate TAG=v0.27.0
make prod-migrate-status TAG=v0.27.0
```

Emergency fallback: `POST /api/admin/migrate` with `Authorization: Bearer $MIGRATION_SECRET` if configured.

## SSL / Certbot

- **Initial:** `make prod-ssl` (requires port 80 reachable for ACME webroot)
- **Renewal cron** (twice daily):

```cron
0 3,15 * * * cd ~/andiko && make prod-renew-certs >> /var/log/andiko-certbot.log 2>&1
```

Before SSL, nginx serves HTTP with a proxy to the app. After `prod-ssl`, `infra/nginx/conf.d/default.conf` is replaced with the HTTPS config.

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

## POS clients

Point each terminal's `cloud_url` to `https://andiko.cloud`.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| `prod-deploy` fails pulling image | `docker login ghcr.io` on VPS; image tag exists |
| Stack not starting | `docker stack ps andiko --no-trunc` |
| Health check fails | `docker service logs andiko_app`; postgres healthy? |
| Migrations fail | `make prod-migrate-status TAG=…`; DATABASE_URL host is `postgres` |
| SSL fails | DNS points to VPS; port 80 open; `CERTBOT_EMAIL` set |
| Secrets changed | `make prod-secrets` then `make prod-deploy TAG=…` |

## Scaling note

v1 uses **one app replica** on one VPS. Vertical scaling (more CPU/RAM) is preferred before adding replicas. Multi-replica horizontal scaling is a future option if traffic requires it.
