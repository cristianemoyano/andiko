# Multitenancy (org_id / branch_id) — Checklist

Este documento define **cómo segmentamos datos** en Andiko para evitar cruces entre tenants.

**Última revisión:** alineado con v0.35.0 — inventario, compras y contabilidad están implementados y son org/branch-scoped.

## Reglas base

- **`org_id` nunca viene del cliente**: se deriva del token/sesión en el backend (`resolveTenantContext()`).
- **`branch_id` sí puede venir del cliente** donde la entidad sea branch-scoped, pero:
  - debe pertenecer al `org_id` en contexto
  - debe estar dentro de las sucursales habilitadas del usuario (`user_branches`)
- **DB + servicios** deben reforzar siempre el scope (no confiar en UI).
- **Sys-admin** puede actuar sobre una org (`actingOrgId`) o impersonar un usuario; las APIs tenant nunca confían un `org_id` del body.

## Clasificación por módulo

### Auth / Tenancy (sys-admin)
- **organizations**: org-scoped (tabla raíz de tenancy).
- **branches**: org-scoped.
- **users**, **user_branches**: org-scoped.
- **org_roles**, **role_permissions**, **permissions**: global + overrides por org.
- **organization_settings**: `enabled_modules`, features, templates — por org.
- **platform_settings**: singleton global (SMTP, emisor billing, storage).

### Contacts — Org-scoped
- `contacts`, `contact_addresses`, `contact_payment_info`

### Catalog — Org-scoped
- `products`, `product_variants`, `product_categories`, `price_lists`, `price_list_items`

### Sales — Branch-scoped
- `sales_quotes`, `sales_quote_items`
- `sales_orders`, `sales_order_items`
- `invoices`, `invoice_items`
- `payments`, `credit_notes`, `debit_notes`, devoluciones y reembolsos
- `document_sequences` (por org + branch + type)
- Permiso opcional `sales:scope_own` limita lecturas/escrituras al vendedor asignado

### Inventory — Org-scoped (operación por depósito/sucursal)
- `warehouses` (vinculados a sucursal; unique warehouse por branch)
- `stock_items`, `stock_item_batches`, `stock_movements`
- `delivery_notes`, transferencias entre depósitos
- Movimientos referencian `branch_id` del depósito; ventas/compras disparan `applyMovement` dentro de transacción

### Purchases — Branch-scoped
- `purchase_orders`, `purchase_order_items`
- `purchase_receipts`, `purchase_receipt_items`
- `supplier_invoices`, `supplier_invoice_items`
- `supplier_payments`, `purchase_returns` y derivados
- Secuencias de documento por org + branch

### Expenses — Branch-scoped (módulo independiente de Purchases; solo comparte `Contact`)
- `expenses`, `expense_payments`, `recurring_expense_templates`
- Secuencias de documento propias por org + branch (mismo mecanismo `document_sequences` que Purchases, tipos `expense`/`expense_payment`)
- `Expense.expense_account_code` referencia el plan de cuentas (`accounts`, org-scoped) — no hay FK, se valida contra cuentas activas/postables al contabilizar
- Las facturas de Expensas se incluyen también en el Libro IVA Compras (módulo `afip`, que ya es cross-module por diseño) para no perder crédito fiscal

### Accounting — Org-scoped (líneas con `branch_id` opcional como centro de costo)
- `accounts`, `journal_entries`, `journal_entry_lines`
- Asientos automáticos: devoluciones de venta/compra, factura de venta emitida (con costo de mercadería vendida si hay `cost_price`), cobro a cliente, factura de compra recibida, pago a proveedor, factura y pago de gasto (Expensas)

### AFIP — Org-scoped
- `afip_credentials`, `afip_emissions`, configuración fiscal por org/sucursal

### POS — Org + branch del dispositivo
- `pos_devices`, `pos_cash_sessions`, `pos_payment_methods`
- APIs POS autentican por `api_token` del dispositivo → `tenantContextFromPosDevice`

### Billing (SaaS plataforma) — Global sys-admin + lectura org propia
- Planes, suscripciones, facturas de plataforma: sys-admin
- Portal `/facturacion`: org-scoped vía `requireOrgBilling` (nunca confía `org_id` del cliente)

### Integraciones — Org-scoped
- WooCommerce: sitios por org, vinculados a sucursal

### Automations — Org-scoped (branch_id opcional)
- `scheduled_tasks`, `scheduled_task_runs`
- `branch_id` opcional; si se especifica, se valida contra sucursales habilitadas del usuario (`assertBranchAllowed` en `scheduled-task.service.ts`)

## Checklist técnico por entidad

Para cada tabla **org-scoped**:
- Columnas: `org_id UUID NOT NULL`
- Índices: `INDEX(org_id)` y `UNIQUE(org_id, …)` donde aplique
- Queries: siempre `where: { org_id: orgId, ... }`

Para cada tabla **branch-scoped**:
- Columnas: `org_id UUID NOT NULL`, `branch_id UUID NOT NULL`
- Índices: `INDEX(org_id, branch_id)` y `UNIQUE(org_id, branch_id, …)` donde aplique
- Consistencia: FK o validación de que `branch_id` pertenece a `org_id`
- Queries (reads+writes): `org_id = orgId AND branch_id IN allowedBranchIds`

## Endpoints: reglas de acceso

- **Listados**: filtran por `org_id` y, si branch-scoped, por branches permitidas.
- **Detalle por `id`**: nunca `findByPk(id)` sin scope; siempre `findOne({ where: { id, org_id, ... } })`.
- **Mutaciones**: validar `branch_id` contra branches permitidas y pertenencia a org.
- **Módulos deshabilitados**: `organization_settings.enabled_modules` + guards en rutas ERP.

## Implementación de referencia

| Pieza | Ubicación |
|-------|-----------|
| Contexto tenant | `src/lib/tenancy.ts` — `resolveTenantContext()` |
| Módulos base vs premium | `src/modules/auth/organization-modules.ts` |
| Permisos | `src/lib/permissions.ts` — `withPermission()` |
| Enforcement migraciones | `src/db/migrations/20260423093000-enforce-org-branch-scope.ts` |

## Features cross-módulo

Cualquier cambio que toque ventas + inventario, compras + stock, o documentos + AFIP debe seguir el checklist en [docs/dev/cross-module-checklist.md](dev/cross-module-checklist.md).
