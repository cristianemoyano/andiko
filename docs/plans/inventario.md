# Plan: Módulo de Inventario (Fase 4)

## Context

El módulo de ventas genera facturas y cobra, pero el stock no se descuenta en ningún momento. El catálogo tiene `ProductVariant.manage_stock` y `stock_quantity` como campo global sin trazabilidad ni soporte de múltiples depósitos. Esta fase crea la estructura correcta: depósitos por sucursal, saldo de stock por variante+depósito y un log inmutable de movimientos, integrado con el flujo de pedidos.

---

## Timing de movimientos de stock

```
Pedido borrador   → sin cambio de stock
Pedido confirmado → stock descontado ✔  ← hook en updateOrder()
Pedido entregado  → sin cambio adicional
Factura emitida   → sin cambio adicional
Pedido cancelado (desde confirmed) → stock repuesto
Factura cancelada → stock repuesto (anular factura = devolver mercadería)
```

**Por qué al confirmar:** evita vender stock comprometido. Un pedido en proceso debe bloquear ese stock inmediatamente.

---

## Diseño de datos

```
warehouses
  id UUID PK, org_id, branch_id, name VARCHAR, description TEXT,
  is_active BOOLEAN DEFAULT TRUE, audit columns

stock_items                          ← ledger variante × depósito
  id UUID PK, variant_id FK, warehouse_id FK, org_id, quantity NUMERIC(15,4)
  UNIQUE(variant_id, warehouse_id), CHECK(quantity >= 0)

stock_movements                      ← log inmutable
  id UUID PK, variant_id FK, warehouse_id FK, org_id
  movement_type ENUM('in','out','adjustment','transfer_in','transfer_out')
  reference_type VARCHAR ('order' | 'invoice_cancel' | 'manual' | 'initial')
  reference_id UUID, quantity_delta NUMERIC(15,4)
  quantity_before NUMERIC(15,4), quantity_after NUMERIC(15,4)
  notes TEXT, audit columns (sin soft delete)
```

`ProductVariant.stock_quantity` se mantiene como suma denormalizada sincronizada en cada transacción.

---

## Fases de implementación

### A. Migraciones (en orden)

1. `20260424140000-add-variant-id-to-line-items.ts`
   - Agrega `variant_id UUID NULL` a `sales_quote_items`, `sales_order_items`, `invoice_items`

2. `20260424141000-create-warehouses.ts`
   - Tabla `warehouses`, UNIQUE `(name, org_id)`, índices por `org_id` y `branch_id`

3. `20260424142000-create-stock-items.ts`
   - Tabla `stock_items`, UNIQUE `(variant_id, warehouse_id)`, CHECK `quantity >= 0`

4. `20260424143000-create-stock-movements.ts`
   - Tabla `stock_movements`, ENUM `movement_type`, sin soft delete

### B. Modelos

- `src/modules/inventory/warehouse.model.ts` — extiende AuditModel
- `src/modules/inventory/stock-item.model.ts` — extiende Model (sin paranoid)
- `src/modules/inventory/stock-movement.model.ts` — extiende Model (sin paranoid)

### C. Servicios

- `src/modules/inventory/warehouses.service.ts`
  - `listWarehouses(orgId, branchId?)`, `getWarehouse(id, orgId)`, `createWarehouse(input, ctx)`, `updateWarehouse`, `deleteWarehouse`
  - `resolveDefaultWarehouse(branchId, orgId, t?)` — helper para encontrar el depósito por defecto de una sucursal

- `src/modules/inventory/stock-movements.service.ts`
  - `applyMovement(params, t)` — actualiza `stock_items` + `ProductVariant.stock_quantity` + registra `stock_movements`
  - `deductStockForOrder(orderId, orgId, t)` — itera `sales_order_items`, llama `applyMovement('out')` por cada ítem trackeable
  - `restoreStockForOrder(orderId, orgId, t)` — inverso, para cancelaciones y anulación de facturas
  - `manualAdjustment(variantId, warehouseId, newQuantity, notes, ctx)` — ajuste manual

- `src/modules/inventory/stock-items.service.ts`
  - `getStockLevels(orgId, filters)` — lista paginada de stock por variante × depósito
  - `getVariantStock(variantId, warehouseId)` — stock de una variante en un depósito

### D. Integración con Ventas

**`src/modules/sales/sales-orders.service.ts`** — `updateOrder()`:
- Si `input.status === 'confirmed'` y el status anterior no era `'confirmed'`: llamar `deductStockForOrder(order.id, ctx.orgId, t)` dentro de la misma transacción
- Si `input.status === 'cancelled'` y el status anterior era `'confirmed'`: llamar `restoreStockForOrder(order.id, ctx.orgId, t)`

**`src/modules/sales/invoices.service.ts`** — `cancelInvoice()`:
- Llamar `restoreStockForOrder(invoice.order_id, invoice.org_id, t)` dentro de la misma transacción

**`src/modules/sales/sales-orders.service.ts`** — `convertOrderToInvoice()`:
- Pasar `variant_id` de `SalesOrderItem` a `InvoiceItem`

**Modelos a actualizar:**
- `sales-order-item.model.ts` — agregar `variant_id: UUID | null`
- `sales-quote-item.model.ts` — agregar `variant_id: UUID | null`
- `invoice-item.model.ts` — agregar `variant_id: UUID | null`

### E. API Routes

Permisos nuevos en DB: `inventory:read`, `inventory:write`, `inventory:delete`

```
src/app/api/v1/inventory/
  warehouses/route.ts           GET (list) + POST (create)
  warehouses/[id]/route.ts      GET + PATCH + DELETE
  stock/route.ts                GET (stock levels, paginado por variante × depósito)
  movements/route.ts            GET (historial) + POST (ajuste manual)
```

### F. Frontend

```
src/app/(erp)/inventario/
  page.tsx + InventarioClient.tsx          ← redirect o dashboard básico
  depositos/
    page.tsx + DepositosClient.tsx         ← lista + CRUD (modal o inline)
    [id]/page.tsx + DepositoDetail.tsx     ← stock de este depósito + historial
  stock/
    page.tsx + StockClient.tsx             ← vista global variante × depósito
  movimientos/
    page.tsx + MovimientosClient.tsx       ← historial con filtros
```

Agregar link "Inventario" en `Sidebar.tsx` o el layout ERP.

---

## Reutilizar existente

- `TenantContext`, `whereOrg()`, `whereAllowedBranches()` — `src/lib/tenancy.ts`
- `AuditModel`, `auditColumnDefs` — `src/lib/base-model.ts`
- `withPermission()` — `src/lib/permissions.ts`
- `paginate`, `toPaginated` — `src/lib/pagination.ts`
- `sequelize.transaction()` patrón — `src/modules/sales/invoices.service.ts`
- `DataTable`, `TablePagination`, `EmptyState`, `ConfirmDialog` — design system existente

---

## Verificación

```bash
pnpm migrate up
pnpm dev
```

1. Crear depósito en `/inventario/depositos` → aparece en lista
2. Ajuste manual de stock para variante con `manage_stock = true`
3. Confirmar un pedido → `stock_items.quantity` bajó + `stock_movements` registrado con `reference_type = 'order'`
4. Cancelar el pedido → stock repuesto
5. Confirmar → entregar → crear factura → emitir → sin nuevo movimiento de stock
6. Cancelar la factura → stock repuesto
7. Variante con `manage_stock = false` → confirmar pedido → sin movimiento
8. Producto tipo `'service'` → sin movimiento
9. `pnpm tsc --noEmit` — sin errores
10. `pnpm test` — tests pasan
