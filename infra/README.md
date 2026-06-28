# Production infrastructure

Operator runbook: **[docs/deployment/production.md](../docs/deployment/production.md)**

Quick reference:

```bash
make prod-push TAG=v0.26.0   # laptop — build + push to GHCR
make prod-init               # VPS — once
make prod-deploy TAG=v0.26.0
make prod-ssl
make prod-migrate TAG=v0.26.0
make prod-health
```
