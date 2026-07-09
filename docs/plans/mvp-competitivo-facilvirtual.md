# Plan: MVP Competitivo vs FácilVirtual

> **Última revisión contra código:** 2026-07-09. Los sprints 1–3 de este plan están **implementados**. Usar [docs/ROADMAP.md](../ROADMAP.md) y la tabla "Estado actual" abajo como referencia; el detalle de sprints queda como historial de implementación.

## Contexto

Para vender Andiko (cloud ERP + POS Electron) a autoservicios y minimercados argentinos hay que cerrar 5 gaps vs FácilVirtual. La buena noticia: la mayoría de los backends **ya existen** — el trabajo es conectarlos al POS y agregar las UIs faltantes.

**Competidor de referencia:** [FácilVirtual Supermercados](https://www.facilvirtual.com.ar/software/software-supermercados)

**Target MVP:** autoservicios y minimercados con 1 caja, sin productos pesables.

---

## Estado actual (2026-07-09)

| Feature | FácilVirtual | Andiko | Estado |
|---|---|---|---|
| POS con barcode scanner | ✓ | ✓ | ✅ |
| Gestión de clientes | ✓ | ✓ | ✅ |
| Catálogo de productos | ✓ | ✓ | ✅ |
| Multi-método de pago (config) | ✓ | ✓ | ✅ tipos dinámicos por org/sucursal |
| Pagos mixtos en un ticket | ✓ | ⚠️ | Backend `payments[]` listo; UI POS un medio por venta |
| Exportación CSV/Excel | ✓ | ✓ | ✅ |
| Etiquetas de góndola | ✓ | ✓ | ✅ |
| Control de stock + lotes FEFO | ✓ | ✓ | ✅ |
| Compras | ✓ | ✓ | ✅ |
| AFIP / CAE | ✓ | ✓ | ✅ WSFE + ticket POS |
| WooCommerce | ✗ | ✓ | ✅ ventaja |
| ERP cloud multi-sucursal | ✗ | ✓ | ✅ ventaja |
| Cierre de caja | ✓ | ✓ | ✅ `ClosingReportScreen.tsx` |
| Listas de precios en POS | ✓ | ✓ | ✅ precio desde lista default |
| Pantalla completa + teclas rápidas | ✓ | ✓ | ✅ fullscreen + atajos |
| Turnos de caja (cash sessions) | ✓ | ✓ | ✅ apertura/cierre + sync cloud |
| Alertas de vencimiento (UI) | ✓ | ✓ | ✅ panel + filtros stock |
| Lista de reposición | ✓ | ✓ | ✅ `/inventario/reposicion` |
| Productos pesables (balanza RS-232) | ✓ | ⚠️ | PLU/barcode pesable en POS; drivers nativos en Fase 8 |
| Firma de código POS | ✓ | ❌ | Pendiente distribución sin fricción |

**Gap restante vs FácilVirtual para autoservicio:** pagos mixtos en checkout POS, integración MP real, firma de código del instalador.

---

## Análisis competitivo (histórico — jun 2026)

| Feature | FácilVirtual | Andiko | Estado |
|---|---|---|---|
| POS con barcode scanner | ✓ | ✓ | ✅ |
| Gestión de clientes | ✓ | ✓ | ✅ |
| Catálogo de productos | ✓ | ✓ | ✅ |
| Multi-método de pago | ✓ | ✓ | ✅ |
| Exportación CSV/Excel | ✓ | ✓ | ✅ |
| Etiquetas de góndola | ✓ | ✓ | ✅ |
| Control de stock | ✓ | ✓ | ✅ |
| Compras | ✓ | ✓ | ✅ |
| ERP cloud multi-sucursal | ✗ | ✓ | ✅ ventaja |
| **Cierre de caja** | ✓ | ✓ | ✅ implementado |
| **Listas de precios múltiples en POS** | ✓ | ✓ | ✅ implementado |
| **Pantalla completa + teclas rápidas** | ✓ | ✓ | ✅ implementado |
| **Alertas de vencimiento (UI)** | ✓ | ✓ | ✅ implementado |
| **Lista de reposición por proveedor** | ✓ | ✓ | ✅ implementado |
| Productos pesables (balanza) | ✓ | ⚠️ | PLU/barcode; sin driver RS-232 |

---

## Sprint 1 — Ser vendible ahora

> ✅ **Implementado.** Ver `ClosingReportScreen.tsx`, fullscreen en `apps/pos/src/main/index.ts`, listas de precios en `/api/v1/pos/products`.

### 1. Cierre de caja POS

**Qué:** Pantalla de cierre de turno con totales del día por método de pago (efectivo, tarjeta, transferencia), cantidad de tickets y total bruto.

**Backend ya existe:** tabla `sales` en SQLite con `payment_method` y `sold_at`.

**Trabajo:**
- `apps/pos/src/main/sales.ts` — nuevo handler `sales:closingReport(date?)`
  - Query agrupando `sales` por `payment_method` donde `sold_at` es hoy
  - Retorna `{ cash, card, transfer, total, count }`
- `apps/pos/src/renderer/screens/ClosingReportScreen.tsx` — pantalla nueva
  - Tabla con totales por método de pago
  - Botón "Imprimir" (`window.print()` sobre div formateado)
- `apps/pos/src/preload/index.ts` — exponer `window.pos.sales.closingReport(date?)`
- `apps/pos/src/renderer/env.d.ts` — agregar tipo
- `apps/pos/src/renderer/App.tsx` — nuevo `NavBtn` en sidebar

---

### 2. Modo pantalla completa + teclas rápidas

**Qué:** App arranca en fullscreen. Atajos de teclado para operaciones frecuentes del cajero.

**Trabajo:**
- `apps/pos/src/main/index.ts`:
  - Agregar `fullscreen: true` en `BrowserWindow`
  - Registrar `F11` para toggle fullscreen
- `apps/pos/src/renderer/screens/SaleScreen.tsx`:
  - `F1` o `Enter` → confirmar venta / checkout
  - `F2` → foco en campo de búsqueda de producto
  - `Escape` → limpiar búsqueda / cancelar

---

### 3. Listas de precios múltiples en POS

**Qué:** El POS aplica el precio de la lista default del ERP, no el `base_price`.

**Backend ya existe:** modelos `PriceList` / `PriceListItem` con flag `is_default`.

**Trabajo:**
- `src/app/api/v1/pos/products/route.ts` — verificar y corregir que el endpoint resuelva precio desde `PriceListItem` donde `price_list.is_default = true`, no desde `base_price`
- `src/modules/catalog/products.service.ts` — ajustar `getProductsForSale()` si es necesario
- `apps/pos/src/main/sync.ts` — verificar que el campo `price` mapeado sea el correcto

---

## Sprint 2 — Completar UX

> ✅ **Implementado.** Widgets de vencimiento en panel; `/inventario/reposicion`.

### 4. UI alertas de vencimiento en ERP

**Qué:** Widgets en el Dashboard con productos vencidos y próximos a vencer. Click lleva al listado filtrado.

**Backend ya existe:** `stock_item.expires_on`, filtros `expired` y `expiring_within_days` en `getStockLevels()`.

**Trabajo:**
- `src/app/(erp)/panel/PanelClient.tsx` — agregar 2 cards:
  - "Productos vencidos" (count con `expired=true`)
  - "Vencen en 7 días" (count con `expiring_within_days=7`)
- `src/app/(erp)/inventory/stock/` — agregar filtro de vencimiento en la UI existente

---

### 5. Lista de reposición por proveedor

**Qué:** Reporte de productos con stock ≤ mínimo, agrupados por proveedor, con cantidad a pedir.

**Trabajo:**
- `src/modules/inventory/stock-items.service.ts` — nuevo método `getReplenishmentList(orgId)`
  - Join `stock_items` → `product_variants` → `products` → contacto proveedor
  - Filtra `quantity <= minimum_quantity`
  - Agrupa por proveedor
- `src/app/api/v1/inventory/stock/replenishment/route.ts` — nuevo endpoint GET
- `src/app/(erp)/inventory/reposicion/` — nueva página con tabla + exportar CSV

---

## Sprint 3 — Gestión de turnos de caja

> ✅ **Implementado.** `cash_sessions` en SQLite, `pos_cash_sessions` en cloud, `/pos/cajas`.

### 6. Cash sessions (apertura y cierre de turno)

**Flujo:**
- Cajero abre turno → declara monto inicial en efectivo
- Las ventas del turno se asocian a la sesión activa
- Al cerrar → sistema muestra monto esperado (apertura + ventas cash), cajero declara monto físico, se registra diferencia
- Turno cerrado se sincroniza al cloud

**SQLite POS:** nueva tabla `cash_sessions` (`id`, `cashier_user_id`, `cashier_name`, `opened_at`, `closed_at`, `opening_amount`, `closing_amount_declared`, `closing_amount_expected`, `difference`, `status: 'open' | 'closed'`)

**Cloud:** nueva tabla `pos_cash_sessions` en PostgreSQL + endpoint sync + UI en ERP (`/pos/cajas`) con historial por sucursal/caja

---

## Fuera del plan (backlog)

- Pagos mixtos en UI POS (backend listo)
- Integración Mercado Pago real (QR/cobros)
- Drivers balanza RS-232 (Fase 8) — hoy PLU/barcode pesable
- Firma de código macOS (Apple Developer ~USD 99/año)
- Firma de código Windows (Authenticode EV ~USD 300-500/año)
- `electron-updater` — auto-update (requiere firma en macOS)
