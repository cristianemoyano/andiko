# Andiko ERP

ERP modular cloud para PyMEs argentinas. Stack: Next.js (App Router), TypeScript, Sequelize, PostgreSQL.

**Producción:** [andiko.cloud](https://andiko.cloud) · **Versión actual:** ver `package.json` (`0.35.0` al momento de este README).

## Módulos

| Módulo | Ruta ERP | Descripción |
|--------|----------|-------------|
| Contactos | `/contactos` | Clientes y proveedores |
| Catálogo | `/catalogo` | Productos, listas de precios |
| Ventas | `/ventas` | Presupuesto → pedido → factura → cobro |
| Inventario | `/inventario` | Depósitos, stock, lotes, remitos |
| Compras | `/compras` | OC → recepción → factura proveedor |
| Contabilidad | `/contabilidad` | Plan de cuentas, asientos, balances |
| POS | `/pos` + `apps/pos` | Punto de venta offline (Electron) |

Documentación extendida: [AGENTS.md](AGENTS.md) (reglas de desarrollo), [docs/ROADMAP.md](docs/ROADMAP.md) (producto), [docs/dev/getting-started.md](docs/dev/getting-started.md) (setup local).

## Requisitos

- Node.js 24+
- pnpm 9+
- Docker (PostgreSQL local vía Compose)

## Setup local

```bash
pnpm install
cp .env.example .env.local   # ajustar DATABASE_URL y AUTH_SECRET
make up                      # PostgreSQL 16 + pgAdmin
pnpm migrate up
pnpm db:seed                 # datos de desarrollo (opcional)
pnpm dev                     # http://localhost:3000
```

Credenciales seed (dev): ver salida de `pnpm db:seed` o `src/db/dev/seed-dev.ts`.

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm check` | typecheck + lint + test en paralelo |
| `pnpm test` | Vitest |
| `pnpm migrate status` | estado de migraciones |
| `pnpm storybook` | design system |
| `make dev` | alias de entorno local |

## Monorepo

- `src/` — ERP web (Next.js)
- `apps/pos/` — POS Electron (versión independiente, tag `pos/v*`)
- `packages/ui`, `packages/db` — compartidos

## Despliegue

Runbook VPS: [docs/deployment/production.md](docs/deployment/production.md).

```bash
make prod-release TAG=v0.35.0   # usar tag de release actual
```

## Contribuir

- Branching: features en `feature/*` o PRs a `develop`; releases a `main` vía `/release`.
- Commits: Conventional Commits con scope obligatorio (`feat(sales): …`).
- Ver [docs/dev/getting-started.md](docs/dev/getting-started.md) y [AGENTS.md](AGENTS.md).

## GTM / operaciones comercial

- [Packaging y precios beta](docs/gtm/packaging.md)
- [Onboarding de clientes](docs/gtm/client-onboarding-runbook.md)
- [Soporte](docs/gtm/support-runbook.md)
- [Programa beta](docs/gtm/beta-program.md)
