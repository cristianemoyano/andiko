## Descripción

<!-- Qué cambia y por qué. Una oración clara para el changelog mental del equipo. -->

## Tipo de cambio

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / chore
- [ ] Docs
- [ ] POS (`apps/pos`)

## Módulos afectados

- [ ] Ventas
- [ ] Compras
- [ ] Inventario
- [ ] Contabilidad
- [ ] AFIP / fiscal
- [ ] Catálogo / Contactos
- [ ] POS
- [ ] Billing / sys-admin
- [ ] Integraciones (WooCommerce)
- [ ] Infra / core

## Checklist ERP

- [ ] `pnpm check` pasa (typecheck + lint + test)
- [ ] Migración reversible incluida (si hay schema)
- [ ] Queries con scope `org_id` / `branch_id` ([MULTITENANCY.md](docs/MULTITENANCY.md))
- [ ] Transacción en operaciones multi-tabla
- [ ] UI: `setRefresh` tras mutaciones
- [ ] Tests de servicio para lógica nueva/modificada
- [ ] [Cross-module checklist](docs/dev/cross-module-checklist.md) (si aplica)

## Checklist flujos financieros / fiscales

_Marcar solo si aplica._

- [ ] Impacto en stock verificado (pedido/recepción/devolución)
- [ ] Impacto en saldos CC cliente/proveedor
- [ ] Emisión AFIP / metering `afip_invoices_issued`
- [ ] Sin math de dinero con `number` (Decimal.js)

## Checklist POS

_Marcar solo si aplica._

- [ ] `cd apps/pos && pnpm typecheck` pasa
- [ ] Cambios IPC: preload + `env.d.ts` actualizados
- [ ] Schema SQLite migrado si corresponde

## ROADMAP

- [ ] `docs/ROADMAP.md` actualizado (checkboxes)

## Screenshots / notas de deploy

<!-- Opcional: capturas, flags de env, pasos post-deploy -->
