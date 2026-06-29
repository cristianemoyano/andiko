# nginx site configs (production)

Live configs are **not** stored in this directory on the VPS.

They live at `${NGINX_CONF_DIR}` (default: `/var/lib/andiko/nginx/conf.d`), outside the git repo, so `git pull` cannot overwrite them.

Templates: `infra/nginx/templates/`. Sync with:

```bash
make prod-sync-nginx-conf    # bootstrap or upgrade to SSL if cert exists
make prod-ssl                # initial TLS + HTTPS configs
```
