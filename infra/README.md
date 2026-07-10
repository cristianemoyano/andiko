# Production infrastructure

Operator runbook: **[docs/deployment/production.md](../docs/deployment/production.md)**

**Production VPS is configured.** Routine deploy:

```bash
ssh root@187.77.235.70
cd /root/andiko
make prod-release
```

**URLs:** [andiko.cloud](https://andiko.cloud) · [portainer.andiko.cloud](https://portainer.andiko.cloud) · [analytics.andiko.cloud](https://analytics.andiko.cloud) (Umami) · [cap.andiko.cloud](https://cap.andiko.cloud) (Cap) · mail `mail.andiko.cloud`

**Mail server:** [docs/deployment/mail-server.md](../docs/deployment/mail-server.md) · Thunderbird: [thunderbird.md](../docs/deployment/thunderbird.md)

**File storage (S3):** [docs/deployment/aws-storage.md](../docs/deployment/aws-storage.md) · Terraform: [terraform/aws-storage/](terraform/aws-storage/)

**Deploy:** `prod-release` updates **app only** (`prod-deploy-app`). Full stack: `prod-deploy-infra` when `docker-stack.yml` or mail/nginx changes. Umami/Cap TLS: `prod-expand-ssl-services`. Umami retention: `prod-purge-umami` (weekly cron). Disk: `prod-disk-check`, `prod-prune`.

New VPS bootstrap: see [production.md § New VPS bootstrap](../docs/deployment/production.md#new-vps-bootstrap-first-time-only).
