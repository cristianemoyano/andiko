# Multitenancy (org_id / branch_id) — Checklist

Este documento define **cómo segmentamos datos** en Andiko para evitar cruces entre tenants.

## Reglas base

- **`org_id` nunca viene del cliente**: se deriva del token/session en el backend.
- **`branch_id` sí puede venir del cliente** donde la entidad sea branch-scoped, pero:
  - debe pertenecer al `org_id` en contexto
  - debe estar dentro de las sucursales habilitadas del usuario (`user_branches`)
- **DB + servicios** deben reforzar siempre el scope (no confiar en UI).

## Clasificación por módulo (estado actual del repo)

### Auth / Tenancy (sys-admin)
- **organizations**: org-scoped (tabla raíz de tenancy).
- **branches**: org-scoped (operativa por org).
- **users**: org-scoped (sys-admin puede ver múltiples orgs; usuario tenant debe tener org).
- **user_branches**: org-scoped por implicancia (relaciona user↔branch).
- **role_permissions / permissions**: global + overrides por org.

### Sales (Ventas)
**Branch-scoped** (requieren `org_id` + `branch_id`):
- `sales_quotes`, `sales_quote_items`
- `sales_orders`, `sales_order_items`
- `invoices`, `invoice_items`
- `payments`
- `document_sequences` (por org + branch + type)

### Contacts
**Org-scoped**:
- `contacts`
- `contact_addresses`
- `contact_payment_info`

### Catalog
**Org-scoped**:
- `products`
- `product_variants`
- `product_categories`
- `price_lists`
- `price_list_items`

### Inventory / Purchases / Accounting
En el repo existen placeholders (`src/modules/{inventory,purchases,accounting}/index.ts`) pero **aún no hay entidades**.

## Checklist técnico por entidad

Para cada tabla **org-scoped**:
- Columnas: `org_id UUID NOT NULL`
- Índices: `INDEX(org_id)` y `UNIQUE(org_id, …)` donde aplique
- Queries: siempre `where: { org_id: orgId, ... }`

Para cada tabla **branch-scoped**:
- Columnas: `org_id UUID NOT NULL`, `branch_id UUID NOT NULL`
- Índices: `INDEX(org_id, branch_id)` y `UNIQUE(org_id, branch_id, …)` donde aplique
- Consistencia: constraint para asegurar que `branch_id` pertenece a `org_id`
- Queries (reads+writes): `org_id = orgId AND branch_id IN allowedBranchIds` (o branch puntual permitido)

## Endpoints: reglas de acceso

- **Listados**: filtran por `org_id` y, si branch-scoped, por branches permitidas.
- **Detalle por `id`**: nunca `findByPk(id)` sin scope; siempre `findOne({ where: { id, org_id, ... } })`.
- **Mutaciones**: validar `branch_id` contra branches permitidas y pertenencia a org.

