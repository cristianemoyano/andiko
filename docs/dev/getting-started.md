# Getting Started — Desarrollo Andiko

Guía para incorporar desarrolladores al monorepo Andiko ERP + POS.

## 1. Prerrequisitos

- Node.js 24+, pnpm 9+
- Docker (Colima o Docker Desktop)
- Git con hooks habilitados (`pnpm install` configura husky)

## 2. Primer arranque

```bash
git clone <repo>
cd andiko
pnpm install
cp .env.example .env.local
```

Editar `.env.local`:

```env
DATABASE_URL=postgresql://andiko:andiko@localhost:5432/andiko
AUTH_SECRET=<openssl rand -base64 32>
```

```bash
make up
pnpm migrate up
pnpm db:seed          # org demo, usuarios, catálogo, ventas de ejemplo
pnpm dev              # ERP en :3000
```

Login: credenciales impresas al final del seed (usuario `admin@demo.local` en org `demo`).

## 3. Estructura del repo

```
src/
  app/(erp)/          # páginas ERP (Server + *Client.tsx)
  app/api/v1/         # REST API
  modules/            # lógica de negocio (services, models)
  components/         # design system
  db/migrations/      # Umzug
apps/pos/             # Electron POS
docs/                 # roadmap, GTM, deployment
```

**Regla de oro:** lógica de negocio solo en `src/modules/*/services`. Rutas delgadas. Ver [AGENTS.md](../../AGENTS.md).

## 4. Flujo de trabajo

1. Branch desde `develop`: `feature/<descripcion>` o `cursor/<descripcion>-2d9d`
2. Antes de commit: `pnpm check`
3. Commits: `tipo(scope): descripción` — scopes en `.commitlintrc.json`
4. PR a `develop` con checklist de [.github/pull_request_template.md](../../.github/pull_request_template.md)
5. Features que cruzan módulos: [cross-module-checklist.md](cross-module-checklist.md)

Comandos Claude (opcional): `.claude/commands/ship-feature.md`, `release.md`.

## 5. POS local

```bash
cd apps/pos
pnpm install
pnpm dev              # Electron en dev
```

Sincronización contra ERP local: configurar URL y token de dispositivo desde `/pos/dispositivos` en el ERP.

## 6. Tests

- Framework: **Vitest** (nunca Jest)
- Unitarios junto al servicio: `*.service.test.ts`
- Integración cross-módulo: `src/modules/**/*.integration.test.ts` (en PR abierto / CI)

```bash
pnpm test
pnpm test -- src/modules/sales/invoices.service.test.ts
```

## 7. Migraciones

```bash
pnpm migrate up
pnpm migrate down     # reversible
pnpm migrate status
```

Nunca modificar migraciones ya aplicadas en prod. Una migración = un cambio lógico.

## 8. Documentos de referencia

| Tema | Doc |
|------|-----|
| Tenancy | [docs/MULTITENANCY.md](../MULTITENANCY.md) |
| Cross-módulo | [docs/dev/cross-module-checklist.md](cross-module-checklist.md) |
| Producción | [docs/deployment/production.md](../deployment/production.md) |
| WooCommerce dev | [docs/dev/woocommerce-local.md](woocommerce-local.md) |
| Roadmap producto | [docs/ROADMAP.md](../ROADMAP.md) |

## 9. Errores comunes

| Síntoma | Causa habitual |
|---------|----------------|
| 403 en API | Permiso faltante o módulo deshabilitado en org |
| Stock no baja | Pedido no confirmado o depósito/sucursal mal asociado |
| AFIP stub | `AFIP_MODE=stub` en `.env.local` — esperado en dev |
| `findByPk` devuelve dato de otra org | Falta scope `org_id` en query |
