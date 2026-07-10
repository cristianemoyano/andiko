# nginx site configs (repo bootstrap)

These files are **tracked in git** as the HTTP bootstrap for new VPS instances.

On production, nginx mounts **`${NGINX_CONF_DIR}`** (default: `/var/lib/andiko/nginx/conf.d`) — outside this repo — so `git pull` never overwrites live configs.

| Repo (bootstrap) | VPS live (runtime) | After `prod-ssl` |
|----------------|--------------------|------------------|
| `default.conf` | `${NGINX_CONF_DIR}/default.conf` | from `templates/andiko.ssl.conf` |
| `portainer.conf` | `${NGINX_CONF_DIR}/portainer.conf` | from `templates/portainer.ssl.conf` |
| `analytics.conf` | `${NGINX_CONF_DIR}/analytics.conf` | from `templates/analytics.ssl.conf` |
| `cap.conf` | `${NGINX_CONF_DIR}/cap.conf` | from `templates/cap.ssl.conf` |

```bash
make prod-sync-nginx-conf   # copy bootstrap to live dir, or upgrade to SSL if cert exists
make prod-ssl               # TLS + HTTPS configs
```
