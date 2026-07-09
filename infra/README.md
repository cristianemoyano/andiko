# Production infrastructure

Operator runbook: **[docs/deployment/production.md](../docs/deployment/production.md)**

**Production VPS is configured.** Routine deploy:

```bash
ssh root@187.77.235.70
cd /root/andiko
make prod-release
```

**URLs:** [andiko.cloud](https://andiko.cloud) · [portainer.andiko.cloud](https://portainer.andiko.cloud) · mail `mail.andiko.cloud`

**Mail server:** [docs/deployment/mail-server.md](../docs/deployment/mail-server.md) · Thunderbird: [thunderbird.md](../docs/deployment/thunderbird.md)

**Deploy:** `prod-release` updates **app only** (`prod-deploy-app`). Full stack: `prod-deploy-infra` when `docker-stack.yml` or mail/nginx changes.

New VPS bootstrap: see [production.md § New VPS bootstrap](../docs/deployment/production.md#new-vps-bootstrap-first-time-only).
