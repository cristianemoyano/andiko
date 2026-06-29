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

Values with spaces must be quoted in `infra/.env.production`, e.g. `BACKUP_GDRIVE_FOLDER="my folder"`.

## Andiko production VPS (Hostinger)

| Item | Value |
|------|--------|
| SSH | `ssh root@187.77.235.70` |
| Hostname | `srv1789017` |
| Repo path | `/root/andiko` |
| Branch | `develop` |
| Domain | `https://andiko.cloud` |
| GHCR image | `ghcr.io/cristianemoyano/andiko` |
| Swarm stack | `andiko` |
| Current tag | `v0.25.2` (update per release) |

```bash
ssh root@187.77.235.70
cd /root/andiko
git pull origin develop
```

---

Fresh VPS with nothing installed — follow in order.

### A. Before touching the VPS

1. **DNS** (Hostinger hPanel or your registrar): `andiko.cloud` and `www.andiko.cloud` → IP pública del VPS.
2. **Hostinger firewall** (panel): permitir TCP **22**, **80**, **443**.
3. **GitHub PAT (laptop):** `write:packages` + `read:packages` → push image.
4. **GitHub PAT (VPS):** solo `read:packages` → pull image.
5. **Laptop — push image** (cuando GHCR login funcione):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u cristianemoyano --password-stdin
make prod-push TAG=v0.25.2
```

### B. Conectar al VPS

```bash
ssh root@187.77.235.70
# hostname: srv1789017
```

### C. Bootstrap del sistema (una sola vez)

Opción rápida — clonar solo el script y ejecutarlo:

```bash
apt-get update && apt-get install -y git
git clone git@github.com:cristianemoyano/andiko.git /root/andiko
cd /root/andiko && git checkout develop
sudo bash infra/scripts/bootstrap-vps.sh
```

Si el repo es **privado** y `git clone` falla, primero creá una SSH key en el VPS:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
# Pegar en https://github.com/settings/keys → New SSH key
```

Instala: `git`, `make`, `curl`, `docker`, `ufw` (22/80/443), e inicializa **Docker Swarm**.

### D. Configurar Andiko en el VPS

```bash
cd ~/andiko   # o /root/andiko
git checkout develop
cp infra/.env.production.example infra/.env.production
nano infra/.env.production
```

Generar secrets (en el VPS o en la laptop):

```bash
openssl rand -base64 32   # repetir para AUTH_SECRET, POSTGRES_PASSWORD, CRON_SECRET
```

Completar en `infra/.env.production`:
- `POSTGRES_PASSWORD` y `DATABASE_URL` (host = `postgres`, no `localhost`)
- `AUTH_SECRET`, `AUTH_URL=https://andiko.cloud`
- `AFIP_MODE=produccion`
- `CERTBOT_EMAIL=tu@email.com`
- `GHCR_IMAGE=ghcr.io/cristianemoyano/andiko`

Login GHCR (PAT de **solo lectura**):

```bash
export GITHUB_TOKEN=ghp_xxxx
echo "$GITHUB_TOKEN" | docker login ghcr.io -u cristianemoyano --password-stdin
```

### E. Deploy inicial

```bash
make prod-init
make prod-deploy TAG=v0.25.2
make prod-migrate TAG=v0.25.2
make prod-health                    # HTTP (antes del certificado)
make prod-ssl                       # HTTPS
make prod-health                    # https://andiko.cloud/api/health
```

### F. Verificar

```bash
docker stack services andiko
docker service logs andiko_app --tail 50
curl -sf http://localhost/api/health    # desde el VPS, antes de SSL
```

---

## First-time bootstrap

(If bootstrap script already ran — start here after `prod-bootstrap-vps`.)

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

### One command (recommended on VPS)

Runs `git pull` → build/push image → **migrations** → deploy → health check. Migrations run **before** deploy so the DB is ready when the new app starts.

```bash
make prod-release
```

Prompts for the tag (default from `package.json`). Override explicitly when needed:

```bash
make prod-release TAG=v0.27.0
make prod-release TAG=v0.27.0 SKIP_PUSH=1    # image already in GHCR (e.g. pushed from laptop)
make prod-release TAG=v0.27.0 SKIP_PULL=1    # code already up to date
```

### Manual steps

```bash
# Laptop
make prod-push TAG=v0.27.0

# VPS
git pull
make prod-migrate TAG=v0.27.0
make prod-deploy TAG=v0.27.0
make prod-health
```

`make prod-deploy` prints a reminder to run migrations. **Never skip `prod-migrate`** when migration files changed.

## Makefile reference

| Target | Where | Description |
|--------|-------|-------------|
| `prod-bootstrap-vps` | VPS (once) | Install Docker, git, make, ufw, swarm init (fresh Debian) |
| `prod-release TAG=…` | VPS | Pull code, push image, migrate, deploy, health |
| `prod-push TAG=…` | Laptop / VPS | Build + push Docker image to GHCR |
| `prod-init` | VPS (once) | Swarm init, data dirs, Docker secrets |
| `prod-secrets` | VPS | Rotate Swarm secrets (then redeploy) |
| `prod-deploy TAG=…` | VPS | Pull image + `docker stack deploy` |
| `prod-ssl` | VPS (once) | Certbot certificate + enable HTTPS |
| `prod-migrate TAG=…` | VPS | Run pending Umzug migrations |
| `prod-migrate-status TAG=…` | VPS | List executed vs pending migrations |
| `prod-create-sysadmin TAG=… EMAIL=… PASSWORD=…` | VPS | Create or reset platform sys-admin user |
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

## Platform sys-admin

Create the first sys-admin (or reset password) on the VPS:

```bash
make prod-create-sysadmin \
  TAG=v0.25.3 \
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
| **`DATABASE_URL: Invalid URL` on migrate** | Password contains `+`, `/`, `=` from base64 — use `openssl rand -hex 32` for `POSTGRES_PASSWORD`, or `git pull` and re-run `make prod-secrets` + `make prod-deploy` (scripts now URL-encode) |
| **`error from registry: denied` on push** | PAT missing `write:packages`; re-login with GitHub **username** (not email); `GHCR_IMAGE` owner must match PAT owner; authorize SSO on org if applicable |
| `prod-deploy` fails pulling image | `docker login ghcr.io` on VPS; image tag exists |
| Stack not starting | `docker stack ps andiko --no-trunc` |
| Health check fails | `docker service logs andiko_app`; postgres healthy? |
| Migrations fail | `make prod-migrate-status TAG=…`; DATABASE_URL host is `postgres` |
| SSL fails | DNS points to VPS; port 80 open; `CERTBOT_EMAIL` set |
| Secrets changed | `make prod-secrets` then `make prod-deploy TAG=…` |

## Scaling note

v1 uses **one app replica** on one VPS. Vertical scaling (more CPU/RAM) is preferred before adding replicas. Multi-replica horizontal scaling is a future option if traffic requires it.
