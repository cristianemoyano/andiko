# Mail server config (docker-mailserver)

Production runbook: **[docs/deployment/mail-server.md](../../docs/deployment/mail-server.md)**

| File | Purpose |
|------|---------|
| `docker-mailserver.env.example` | Template env vars (committed) |
| `docker-mailserver.env` | Live env on VPS (gitignored; created by `make prod-init-mail`) |

Quick start on VPS:

```bash
make prod-init-mail
make prod-expand-ssl-mail
make prod-deploy TAG=v0.35.0
make prod-mail-add-user EMAIL=erp@andiko.cloud PASSWORD='...'
make prod-mail-dkim
```
