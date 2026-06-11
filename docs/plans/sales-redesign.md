# Plan: Rediseño del módulo de Ventas

## Context

El módulo de ventas (ventas) es el módulo principal del ERP pero fue construido con un patrón CRUD básico. Los problemas clave:

1. **Sin integración con el catálogo** — Las líneas de documento usan texto libre; el catálogo de productos existe y está completo pero no está conectado a ventas.
2. **Formularios en modales** — Documentos complejos (presupuesto/pedido/factura) se abren en `<Dialog>`, lo cual limita el espacio y crea scroll dentro del modal.
3. **DateInput con máscara de texto** — No es un date picker real con calendario.
4. **Sin pipeline de estado visual** — El usuario no puede ver de forma clara dónde está un documento en el flujo Presupuesto → Pedido → Factura.
5. **Sin lista de precios por documento** — No se puede seleccionar qué lista de precios usar al crear un presupuesto.
6. **Flujo de negocio incorrecto** — Actualmente se puede crear una factura standalone sin ningún pedido. Las facturas deben estar siempre atadas a un pedido entregado.

**Objetivo:** Modernizar el UX al estilo Odoo/WooCommerce, corregir el flujo Quote→Order→Invoice, integrar catálogo de productos, date picker real, listas de precios por documento.

---

## Flujo de negocio correcto

```
Presupuesto ──── independiente, puede morir solo
     │ (si es aceptado)
     ▼
  Pedido ──────── puede crearse directo (venta directa, sin presupuesto)
     │             estados: Borrador → Confirmado → En proceso → Entregado
     │ (solo desde estado Entregado)
     ▼
  Factura ──────── SIEMPRE atada a un pedido entregado, NUNCA standalone
```

**Reglas:**
- Un presupuesto puede vivir y morir de forma independiente.
- Un pedido puede crearse directamente (venta directa) o desde un presupuesto aceptado.
- Una factura **siempre** debe tener un `order_id` y el pedido debe estar en estado `delivered`.
- No existe creación de facturas desde cero en la UI ni en la API.
- Los flujos de estado de pedidos pueden variar por organización — los estados actuales son el estándar; la configuración de flujos personalizados es una mejora futura.

**Impacto sobre la implementación:**
- El `InvoiceModal` desaparece completamente.
- La sección "Facturas" no tiene botón "Nueva Factura" — es una vista de lectura de todas las facturas emitidas.
- El botón "Crear Factura" vive en el detalle del **Pedido**, visible solo cuando `status === 'delivered'`.
- `order_id` pasa a ser requerido en schema Zod e idealmente NOT NULL en DB.

---

## Phase 1: DatePicker moderno

Reemplazar `DateInput` (máscara de texto) por un picker real con calendario.

**Instalar dependencia:**
```
pnpm add react-day-picker
```

**Archivos a crear:**
- `src/components/primitives/DatePicker.tsx` — Radix Popover + `react-day-picker` + Tailwind
  - Misma API que DateInput: `value`, `onChange`, `error`, `placeholder`
  - Input muestra DD/MM/YYYY — al hacer foco o click en ícono calendario, abre popover
  - Navegación por mes/año, selección de día
- `src/components/primitives/DatePicker.stories.tsx` — stories: default, con valor, error, disabled

**Reemplazar DateInput en todos los modales y páginas de ventas** (Fase 5 lo hace en bulk).

---

## Phase 2: API — búsqueda de productos para ventas

**Nuevo archivo:** `src/app/api/v1/catalog/products/for-sale/route.ts`

```
GET /api/v1/catalog/products/for-sale?search=X&price_list_id=Y&limit=20
```

- Usa `listProducts()` de `src/modules/catalog/products.service.ts` con filtro de búsqueda
- Para cada resultado (variante default), llama `getEffectivePrice(priceListId, variantId, orgId)` de `src/modules/catalog/price-list.service.ts`
- Responde `{ data: SaleProductOption[] }` con: `product_id`, `variant_id`, `name`, `sku`, `iva_rate`, `unit_of_measure`, `price`
- Requiere permiso `sales:read`

---

## Phase 3: Backend — flujo correcto + lista de precios por documento

### 3a. Hacer `order_id` requerido en facturas

**Nueva migración:** `src/db/migrations/YYYYMMDDHHMMSS-require-order-id-on-invoices.ts`
- `up`: `ALTER TABLE invoices ALTER COLUMN order_id SET NOT NULL`
  - Nota: en dev no hay datos que rompan esto; si hubiera, limpiar antes.
- `down`: `ALTER TABLE invoices ALTER COLUMN order_id DROP NOT NULL`

**Actualizar `convertOrderToInvoice`** en `src/modules/sales/sales-orders.service.ts`:
- Cambiar condición de `status === 'confirmed' || status === 'in_progress'` → `status === 'delivered'`
- Mensaje de error actualizado: `'ORDER_NOT_DELIVERED'`

**Actualizar `invoiceSchema`** en `src/modules/sales/invoice.schema.ts`:
- `order_id`: cambiar de `z.string().uuid().nullable().optional()` → `z.string().uuid()` (requerido)

**Actualizar `createInvoice`** en `src/modules/sales/invoices.service.ts`:
- Agregar validación: buscar el pedido por `order_id`, verificar que exista, que pertenezca al mismo `org_id`, y que `status === 'delivered'`
- Lanzar error `'ORDER_NOT_DELIVERED'` si no cumple

**Endpoint `POST /api/v1/sales/invoices`:** ya no es público en la UI, pero si alguien lo llama directamente, el servicio ahora valida el pedido.

### 3b. Lista de precios por documento

**Nueva migración:** `src/db/migrations/YYYYMMDDHHMMSS-add-price-list-to-sales-docs.ts`
- `up`: columna nullable `price_list_id UUID` + FK a `price_lists` en `sales_quotes`, `sales_orders`, `invoices`
- `down`: eliminar columnas

**Actualizaciones de modelos:**
- `src/modules/sales/sales-quote.model.ts` — agregar campo `price_list_id`
- `src/modules/sales/sales-order.model.ts` — ídem
- `src/modules/sales/invoice.model.ts` — ídem

**Actualizaciones de schemas (Zod):**
- `src/modules/sales/sales-quote.schema.ts` — `price_list_id: z.string().uuid().optional()`
- `src/modules/sales/sales-order.schema.ts` — ídem
- `src/modules/sales/invoice.schema.ts` — ídem (se hereda del pedido al convertir)

**Tipos frontend:**
- `src/app/(erp)/ventas/types.ts` — agregar `price_list_id?: string` a `Quote`, `Order`, `Invoice`

Los servicios no necesitan cambios significativos — `price_list_id` fluye como campo regular.

### 3c. Propagar price_list_id al convertir

En `convertOrderToInvoice` (`sales-orders.service.ts`): incluir `price_list_id` del pedido al crear la factura.
En `convertQuoteToOrder` (`sales-quotes.service.ts`): incluir `price_list_id` del presupuesto al crear el pedido.

---

## Phase 4: Componentes compartidos nuevos

### 4a. `SalesLineItemsEditor`

**Nuevo archivo:** `src/components/erp/SalesLineItemsEditor.tsx`

Reemplaza la lógica de líneas duplicada en QuoteModal, OrderModal, InvoiceModal.

```typescript
interface SalesLineItemsEditorProps {
  items: LineItemInput[]
  onChange: (items: LineItemInput[]) => void
  priceListId?: string | null
  disabled?: boolean
}
```

**Columnas:** Producto | Descripción | Cant | P.Unit | Desc% | IVA | Total

**Comportamiento de la columna Producto:**
- `SearchableSelect` que llama `GET /api/v1/catalog/products/for-sale?search=X&price_list_id=Y`
- Al seleccionar: auto-completa `description`, `unit_price`, `iva_rate`
- Si se borra el producto: descripción/precio quedan editables (libre)
- La descripción y precio son siempre editables (el usuario puede sobrescribir)

**Reutilizar:** `CurrencyInput` para unit_price, `SearchableSelect` para producto e IVA rate.

### 4b. `StatusPipeline`

**Nuevo archivo:** `src/components/erp/StatusPipeline.tsx`

Stepper horizontal con los estados del documento.

```typescript
interface StatusPipelineProps {
  type: 'quote' | 'order' | 'invoice'
  status: string
}
```

- Quote: Borrador → Enviado → Aceptado (ramas: Rechazado, Expirado)
- Order: Borrador → Confirmado → En proceso → Entregado (rama: Cancelado)
- Invoice: Borrador → Emitida → Pago parcial → Pagada (rama: Cancelada)

Paso activo resaltado, pasos completados con check, pasos futuros en gris.

---

## Phase 5: Formularios de página completa (reemplaza los modales)

El cambio de UX más importante. Los formularios de creación/edición pasan de `<Dialog>` a páginas completas (patrón Odoo).

### Nueva estructura de rutas (igual para pedidos):
```
/ventas/presupuestos              → lista
/ventas/presupuestos/nuevo        → formulario de creación
/ventas/presupuestos/[id]         → vista/edición combinada
```

### Layout del formulario (inspirado en Odoo):
```
┌─────────────────────────────────────────────────────────┐
│ ← Presupuestos   PRES-01-0001              [Acciones ▼] │
│ ══════════════════════════════════════════════════════  │
│ ● Borrador  ─── ○ Enviado  ─── ○ Aceptado              │
├─────────────────────────────────────────────────────────┤
│ Cliente [SearchableSelect]    Sucursal [Select]         │
│ Lista de precios [Select]     Válido hasta [DatePicker] │
│ Condición de pago: [Contado] [30d] [60d] [90d]         │
├─────────────────────────────────────────────────────────┤
│  LÍNEAS                                                 │
│  Producto │ Descripción │ Cant │ Precio │ Desc% │ IVA   │
│  ─────────┼─────────────┼──────┼────────┼───────┼──── │
│  [Buscar] │ [Auto]      │ [1]  │ [...]  │ [0]   │ [21] │
│                                    [+ Agregar línea]    │
├─────────────────────────────────────────────────────────┤
│ Notas para el cliente [Textarea]                        │
│ Notas internas [Textarea]                               │
├─────────────────────────────────────────────────────────┤
│                              Subtotal:   $10.000        │
│                              IVA 21%:    $ 2.100        │
│                              ──────────────────         │
│                              Total:      $12.100        │
│                                  [Cancelar] [Guardar]   │
└─────────────────────────────────────────────────────────┘
```

### Página `[id]` — Vista + Edición combinada:
- Por defecto: modo lectura (muestra info del documento + StatusPipeline + acciones)
- Botón "Editar": cambia a modo edición (mismos campos ahora editables in place)
- Al guardar: vuelve a modo lectura y re-fetcha
- Las acciones (Emitir, Cancelar, Convertir) son botones en el header, no en el modal

### Archivos a crear:

**Presupuestos:**
- `src/app/(erp)/ventas/presupuestos/nuevo/page.tsx` — Server: metadata
- `src/app/(erp)/ventas/presupuestos/nuevo/NuevoPresupuestoClient.tsx` — form en modo creación

**Pedidos:**
- `src/app/(erp)/ventas/pedidos/nuevo/page.tsx`
- `src/app/(erp)/ventas/pedidos/nuevo/NuevoPedidoClient.tsx`

**Facturas:** ⚠️ No hay página `/facturas/nuevo`. Las facturas se crean desde el detalle del pedido.

### Archivos a actualizar:
- `src/app/(erp)/ventas/presupuestos/[id]/QuoteDetail.tsx` — rediseño completo: modo lectura + edición in place, StatusPipeline, layout Odoo
- `src/app/(erp)/ventas/pedidos/[id]/OrderDetail.tsx` — ídem + botón "Crear Factura" visible solo cuando `status === 'delivered'`
- `src/app/(erp)/ventas/facturas/[id]/InvoiceDetail.tsx` — rediseño: header con info del pedido origen, StatusPipeline, sección de pagos
- `src/app/(erp)/ventas/facturas/FacturasClient.tsx` — sin botón "Nueva Factura", solo lista de facturas emitidas

### Archivos a eliminar:
- `src/app/(erp)/ventas/presupuestos/QuoteModal.tsx`
- `src/app/(erp)/ventas/pedidos/OrderModal.tsx`
- `src/app/(erp)/ventas/facturas/InvoiceModal.tsx` ← ya no existe creación standalone

---

## Phase 6: Rediseño de vistas de lista

**Archivos a actualizar:**
- `src/app/(erp)/ventas/presupuestos/PresupuestosClient.tsx`
- `src/app/(erp)/ventas/pedidos/PedidosClient.tsx`
- `src/app/(erp)/ventas/facturas/FacturasClient.tsx`

**Cambios:**
- Fila de KPIs en la parte superior (cantidad de documentos, monto total, cantidad por estado relevante)
- Filtros de estado como pill buttons (no dropdown select)
- Click en fila → navega a `/[id]` (eliminar columna de botones "Ver"/"Editar")
- Botón "Nuevo" navega a `/nuevo` en lugar de abrir modal
- Mejor jerarquía visual en columnas

---

## Phase 7: Navegación (VentasSubNav)

**Archivo:** `src/app/(erp)/ventas/VentasSubNav.tsx`

- Diseño más visual con íconos por sección
- Badges con conteo de documentos pendientes de acción (ej: facturas sin emitir)
- Indicador visual de flujo: Presupuestos → Pedidos → Facturas

---

## Reutilizar existente

- `SearchableSelect` de `src/components/erp/SearchableSelect.tsx` — para selector de producto en líneas
- `getEffectivePrice()` de `src/modules/catalog/price-list.service.ts` — para precio auto-fill
- `listProducts()` de `src/modules/catalog/products.service.ts` — para búsqueda de productos
- `TotalsFooter` de `src/components/erp/TotalsFooter.tsx` — sin cambios
- `CurrencyInput` de `src/components/primitives/CurrencyInput.tsx` — sin cambios
- `calcLine` / `calcTotals` de la lógica existente en modales — ver `src/modules/sales/sales.math.ts`

---

## Verification

```bash
pnpm dev
```

**Flujo de negocio correcto:**
1. `/ventas/facturas` — NO tiene botón "Nueva Factura"
2. Intentar `POST /api/v1/sales/invoices` sin `order_id` → 422 error
3. Intentar crear factura desde pedido no entregado → error `ORDER_NOT_DELIVERED`
4. Marcar un pedido como entregado → aparece botón "Crear Factura" en el detalle
5. Click "Crear Factura" → crea la factura y redirige a `/ventas/facturas/[id]`

**Integración con catálogo:**
6. Abrir form de nuevo presupuesto o pedido → columna Producto en líneas
7. Escribir en búsqueda de producto → aparecen sugerencias del catálogo con precio
8. Seleccionar producto → auto-completa descripción, precio e IVA
9. Cambiar lista de precios → precios de productos actualizados

**UX general:**
10. `+ Nuevo Presupuesto` → navega a `/ventas/presupuestos/nuevo`, form full-page
11. Guardar → redirige a `/[id]`, modo lectura con StatusPipeline
12. Clic "Editar" → campos editables in place
13. DatePicker en todos los campos de fecha → abre calendario, selecciona día
14. `/ventas/presupuestos/[id]` → StatusPipeline muestra etapa correcta

**Calidad:**
15. `pnpm tsc --noEmit` — sin errores de tipos
16. `pnpm test` — tests pasan
