# Plan: Gaps competitivos — Vencimientos, Etiquetas de Góndola, Lectores de Barcode

## Context

Análisis competitivo contra FácilVirtual identificó tres gaps técnicos concretos.
El objetivo es cerrarlos para tener paridad funcional con software de supermercados del mercado local.

---

## 1. Alertas de Vencimiento — prerequisito: modelo de Lotes (Batches)

### Problema
El `expires_on` actual está en `stock_items` (1 fila por variante+depósito), lo cual es incorrecto: un mismo producto puede tener múltiples lotes con fechas de vencimiento distintas. Sin lotes, las alertas de vencimiento no tienen sentido real.

### Estado actual a remover/refactorizar
- `expires_on` en `stock_items` (migración `20260424210000-add-stock-item-minimum-and-expires-on.ts`) — se migra al modelo de lotes
- `updateStockItemAlerts` en `stock-items.service.ts` — reemplazar
- Filtros de expiry en `getStockLevels` — mover a queries por batch
- UI en `StockClient.tsx`, `DepositoDetail.tsx`, `AjusteStockModal.tsx` — actualizar

### Scope total del refactor: 19 archivos, ~25-35h

### Nuevo modelo: `stock_item_batches`

**Nueva migración:** `YYYYMMDDHHMMSS-add-stock-item-batches.ts`
```sql
CREATE TABLE stock_item_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  lot_number    VARCHAR,            -- número de lote del proveedor (opcional)
  quantity      NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expires_on    DATE,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_item_batches_item ON stock_item_batches(stock_item_id);
CREATE INDEX idx_stock_item_batches_org_expires ON stock_item_batches(org_id, expires_on) WHERE expires_on IS NOT NULL;
```
- `stock_items.quantity` se mantiene como **agregado denormalizado** (suma de batches) para queries rápidas
- `stock_items.expires_on` se **elimina** (nueva migración que dropea la columna)

**Lógica de movimientos (stock-movements.service.ts):**
- Inbound (compra, ajuste positivo): crear o incrementar un batch con su `lot_number` y `expires_on`
- Outbound (venta, ajuste negativo): deducir por FIFO (batch con `expires_on` más próximo primero, o `received_at` si no tiene fecha)
- V1: si la deducción supera la cantidad de un batch, tomar del siguiente. No requerir que el usuario seleccione el lote manualmente.

**Archivos críticos:**
- Nueva: `src/modules/inventory/stock-item-batch.model.ts`
- Nueva: `src/modules/inventory/stock-item-batches.service.ts`
- Modificar: `src/modules/inventory/stock-items.service.ts` — quitar expires_on, agregar aggregation desde batches
- Modificar: `src/modules/inventory/stock-movements.service.ts` — FIFO batch deduction
- Modificar: `src/modules/inventory/stock-level.schema.ts` — quitar expires_on del patch schema
- Modificar: `src/app/api/v1/inventory/stock/route.ts` — nuevos endpoints para batches
- Modificar: `src/app/(erp)/inventario/depositos/[id]/AjusteStockModal.tsx` — agregar lot_number + expires_on por lote
- Modificar: `src/app/(erp)/inventario/stock/StockClient.tsx` — mostrar earliest expiry por producto

### Widget de alertas (post-refactor)
Una vez que hay batches, el widget en `src/app/(erp)/inventario/page.tsx` agrega contadores desde `stock_item_batches` filtrando por `expires_on`.

---

## 2. Etiquetas de Góndola

### Estado actual
- ✅ `barcode` en `product_variants` (EAN/UPC)
- ✅ Infraestructura de impresión browser-native (`window.print()` + CSS `@media print`)
- ✅ Patrón de rutas de impresión en `src/app/(document-print)/`
- ❌ **Gap**: ningún template de etiqueta de góndola

### Approach
Pantalla de selección masiva de etiquetas. El usuario selecciona productos por categoría o individualmente, define cantidad de copias por ítem, y lanza una única página de impresión con todas las etiquetas.

**Nueva ruta ERP:** `src/app/(erp)/catalogo/etiquetas/`
- `page.tsx` — Server Component
- `EtiquetasClient.tsx` — Client Component con:
  - Filtro por categoría (usa categorías existentes del catálogo)
  - Lista de variantes con checkboxes + input de cantidad de copias (default 1)
  - Botón "Seleccionar todo" / "Deseleccionar"
  - Botón "Imprimir selección" → abre `/print/etiquetas?ids=...&qty=...` en nueva pestaña

**Nueva ruta de impresión:** `src/app/(document-print)/etiquetas/print/page.tsx`
- Recibe query params: `ids` (lista de variant_ids), `qty` (cantidades por id), `size` (small|large)
- Fetcha variantes + precio desde catálogo service
- Renderiza grilla de etiquetas repetidas según cantidad: nombre, SKU, precio ARS, barcode
- CSS `@media print` con tamaño de página y márgenes para hoja A4

**Agregar link en navegación del catálogo:** `src/app/(erp)/catalogo/` — link a `/catalogo/etiquetas`

**Archivos críticos:**
- `src/app/(erp)/catalogo/etiquetas/` — nueva carpeta
- `src/app/(document-print)/etiquetas/print/page.tsx` — nueva ruta print
- `src/app/(erp)/catalogo/` — agregar link en nav

---

## 3. Lectores de Código de Barras (POS)

### Gap técnico
Los lectores USB/BT actúan como **teclado HID** (envían el código + Enter) — no requieren drivers especiales. El POS ya tiene un input de búsqueda. El único gap real es que:
- `barcode` no está en el payload de sync del POS (`packages/shared/src/index.ts`, línea 21-29)
- El schema SQLite del POS no tiene columna `barcode` (`apps/pos/src/db/schema.ts`)
- El search en `apps/pos/src/main/products.ts` busca por SKU/nombre, no por barcode

### Cambios (4 archivos, bajo riesgo):

1. **`packages/shared/src/index.ts`** — agregar `barcode: string | null` a `PosProduct`

2. **`apps/pos/src/db/schema.ts`** — agregar columna `barcode TEXT` a la tabla `products`

3. **`apps/pos/src/main/db.ts`** — agregar `ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT` en la inicialización (SQLite inline migration)

4. **`apps/pos/src/main/products.ts`** — ampliar query de búsqueda:
   ```sql
   WHERE (name LIKE ? OR sku LIKE ? OR barcode = ?)
   ```
   Match exacto por barcode tiene prioridad: si hay match exacto, agregar al carrito directamente (lógica ya existe por SKU en `SaleScreen.tsx` líneas 289-300).

5. **`apps/pos/src/main/sync.ts`** — incluir `barcode` en el SELECT al cloud al sincronizar productos.

---

## Orden de implementación

1. **Lectores barcode** (~1h, bajo riesgo, completamente independiente)
2. **Etiquetas de góndola** (~3h, independiente, listo para vender)
3. **Modelo de lotes** (~25-35h, prerequisito para alertas de vencimiento — feature separada)

## Verificación

- **Barcode**: agregar barcode a producto en catálogo ERP → sincronizar POS → escribir el barcode en el input del POS → el producto se agrega al carrito automáticamente
- **Etiquetas**: ir a `/catalogo/etiquetas` → filtrar por categoría → seleccionar varios → "Imprimir selección" → nueva pestaña → Ctrl+P produce hoja A4 con todas las etiquetas
- **Lotes**: ingresar stock con lot_number + expires_on → verificar que deducción por venta usa FIFO → widget en `/inventario` muestra contadores correctos
