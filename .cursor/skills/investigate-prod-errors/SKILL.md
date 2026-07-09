---
name: investigate-prod-errors
description: >-
  Systematic workflow to investigate production and staging errors in Andiko
  ERP: confirm deployed version, read VPS Docker logs, query PostHog Error
  Tracking, map failures to code, reproduce, and verify fixes. Use when the user
  reports 500s, prod bugs, andiko.cloud errors, broken screens, or asks to
  investigate exceptions in production or staging.
---

# Investigate production errors (Andiko)

## Scope

Diagnose **runtime failures** (HTTP 5xx, broken UI, failed mutations, timeouts). Not for feature design or routine deploys — see `docs/deployment/production.md` and `/release` for shipping.

**Principle:** gather evidence before fixing. Confirm what is deployed, what the server actually logged, then map to code.

## Environments

| Env | URL | Primary signals |
|-----|-----|-----------------|
| **Production** | https://andiko.cloud | VPS Docker logs, PostHog Error Tracking |
| **Staging** | Vercel preview | Vercel deployment/runtime logs, PostHog (if configured) |
| **Local** | `localhost:3000` | Dev server output; PostHog off unless `NEXT_PUBLIC_POSTHOG_DEV=true` |

Prod and staging **do not share** env vars. Code merged to `develop` is not live on prod until `make prod-release` on the VPS.

## Investigation workflow

```
- [ ] 1. Clarify symptom (URL, status, user/org, since when, steps to reproduce)
- [ ] 2. Classify layer (client / API / auth / infra / deploy mismatch)
- [ ] 3. Confirm deployed version matches expected fix
- [ ] 4. Collect server-side evidence (logs first)
- [ ] 5. Cross-check PostHog Error Tracking / logs (if available)
- [ ] 6. Map evidence → source (route, service, component)
- [ ] 7. Reproduce locally or with a targeted test
- [ ] 8. Fix root cause; run `rtk pnpm check` before ship
- [ ] 9. Verify on prod after deploy
```

**Do not skip steps 3–4.** PostHog may be empty; logs and version tags are the reliable baseline.

---

## Step 1 — Classify the failure

| Signal | Likely layer | Next check |
|--------|--------------|------------|
| `GET /api/v1/...` → 500 JSON | API route → service | Server logs for that path |
| Page loads, section empty / toast | Client fetch failed | Network tab: failing request + response body |
| Full-page "Algo salió mal" | React error boundary | Client exception + server logs for RSC/data |
| `Failed to find Server Action` after deploy | Stale client bundle | Hard refresh; confirm single app version |
| `401` / `403` on API | Auth / permissions | Session, org context — not necessarily a crash |
| `502` / timeout | nginx / app down | Health check, `docker service ps` |

**Trap:** unauthenticated `curl` to protected APIs returns **401**, not the underlying error. Use logs or an authenticated session.

---

## Step 2 — Confirm deployed version

```bash
ssh -o BatchMode=yes root@187.77.235.70 \
  "docker service inspect andiko_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'"
```

Compare image tag to [GitHub Releases](https://github.com/cristianemoyano/andiko/releases) and `package.json`. If the user still hits a "fixed" bug, prod may be on an older image.

```bash
curl -sf https://andiko.cloud/api/health
```

---

## Step 3 — Production logs (primary evidence)

| Item | Value |
|------|-------|
| SSH | `root@187.77.235.70` |
| Repo on VPS | `/root/andiko` |
| Swarm stack | `andiko` |
| App service | `andiko_app` |

**Tail errors for a route or keyword** (replace `KEYWORD` with path fragment, module name, or error text):

```bash
ssh -o BatchMode=yes root@187.77.235.70 \
  "docker service logs andiko_app --since 30m 2>&1 \
   | grep -iE 'KEYWORD|⨯ Error|Error \[|/api/v1/' \
   | tail -80"
```

**Current replica only** — after deploy, old tasks may still show resolved errors:

```bash
ssh -o BatchMode=yes root@187.77.235.70 \
  "docker service ps andiko_app --no-trunc | head -3"
```

On VPS: `make prod-logs`. UI: [Portainer](https://portainer.andiko.cloud) → stack `andiko` → `app`.

**Extract from log lines:**

- Exception type and message
- Stack trace or chunk path (e.g. `.next/server/chunks/src_modules_catalog_...` → `src/modules/catalog/`)
- Request context: path, `org_id`, user if logged
- `sql:` line if present (DB layer)
- Timestamp vs last deploy

---

## Step 4 — PostHog (secondary, when instrumented)

Project: [Error tracking](https://us.posthog.com/project/495939/error_tracking)

1. `query-error-tracking-issues-list` — filter by route, exception text, or URL
2. `query-error-tracking-issue` + `query-error-tracking-issue-events` — stack, `$session_id`, properties
3. Optional: `query-logs` with `serviceNames: ["andiko"]`, `severityLevels: ["error"]`, `searchTerm`. **Always set `dateRange`** (e.g. `{ "date_from": "-24h" }`).

**If PostHog is empty**, do not stop — use step 3. Common gaps:

| Cause | Action |
|-------|--------|
| Build without error instrumentation | Rely on Docker logs |
| Token missing at image build | Check `infra/.env.production` + Docker build args |
| Local dev | PostHog disabled unless `NEXT_PUBLIC_POSTHOG_DEV=true` |
| Search window too narrow | Widen `dateRange` or use logs |
| Client opt-out of cookies | Server `$exception` may still exist; check both |

PostHog **logs** (OTLP/pino) ≠ **Error Tracking** (`$exception`).

Wiring: `instrumentation.ts` (`onRequestError`), `instrumentation-client.ts`, `src/lib/posthog-errors.ts`.

---

## Step 5 — Map evidence to code

Use the architecture map:

```
Browser → API route (src/app/api/v1/...)
       → service (src/modules/{module}/*.service.ts)
       → models / lib / external integrations
```

| Evidence | Where to look |
|----------|----------------|
| `/api/v1/catalog/products` | `src/app/api/v1/catalog/products/route.ts` → `products.service.ts` |
| Chunk `src_modules_inventory_...` | `src/modules/inventory/` |
| `MODULE_DISABLED` / `FORBIDDEN` | `src/lib/api-handler.ts`, org settings |
| Multitenancy / wrong org data | `docs/MULTITENANCY.md`, `whereOrg()` usage |

```bash
rtk git log --oneline -15 -- path/to/suspect.ts
rtk grep 'error fragment' src/modules/<module>
```

---

## Step 6 — Reproduce and validate fix

```bash
rtk pnpm check
rtk test -- pnpm exec vitest run path/to/relevant.test.ts
```

Prefer a failing test or a minimal local repro over log-only guesses. For API bugs, trace: route validation → service call → DB/integration.

---

## Step 7 — Report findings

```markdown
## Síntoma
[qué ve el usuario, URL, status HTTP, desde cuándo]

## Evidencia
[versión en prod, log excerpt o issue de PostHog]

## Causa raíz
[qué falló y por qué — 1–3 oraciones]

## Huecos de observabilidad (si aplica)
[por qué PostHog/logs no mostraron el error antes]

## Fix propuesto
[archivos y enfoque]

## Verificación
[qué probar después del deploy]
```

---

## Quick reference

| Task | Command |
|------|---------|
| Health | `curl -sf https://andiko.cloud/api/health` |
| Prod image | `ssh … docker service inspect andiko_app --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'` |
| App logs | `ssh … docker service logs andiko_app --since 30m` |
| Latest release | `gh release view --json tagName` |
| Full check | `rtk pnpm check` |

## Related docs

- [docs/deployment/production.md](../../../docs/deployment/production.md) — VPS, SSH, `make prod-release`
