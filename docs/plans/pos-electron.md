# Plan: POS Electron — Arquitectura

## Context

Andiko necesita un POS (Point of Sale) que funcione en locales físicos con conectividad inestable. El POS debe operar en modo degradado sin internet (precios y productos cacheados), sincronizar ventas al cloud de manera eventual, y validar la licencia con el servidor central.

---

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Capa | Tecnología | Motivo |
|---|---|---|
| App shell | Electron (Windows + Mac) | Cross-platform, acceso a impresoras, sistema de archivos |
| Frontend POS | React + Vite + Tailwind | UI rápida, sin overhead de Next.js |
| Componentes UI | `@andiko/ui` (packages/ui) | Reutiliza Button, Badge, Input del ERP |
| Tipos compartidos | `@andiko/shared` (packages/shared) | Sin duplicar interfaces |
| BD local | SQLite vía `better-sqlite3` | Sync, síncrono, sin servidor |
| ORM local | Drizzle ORM (SQLite dialect) | Tipado, migraciones en bundle |
| Sync cloud | REST hacia Andiko API | Reutiliza auth existente |
| Impresión | `electron-pos-printer` o WebUSB | Tickets térmicos |

---

## Repositorio — Monorepo en el mismo repo

Convertir el repo actual en un pnpm workspace. El Next.js ERP pasa a `apps/web/`, el POS vive en `apps/pos/`. Los componentes y tipos compartidos se extraen a `packages/`.

```
andiko/                         ← raíz del monorepo
  apps/
    web/                        ← Next.js ERP (actual src/ se mueve acá)
    pos/                        ← Electron + Vite + React
  packages/
    ui/                         ← Design system compartido (@andiko/ui)
                                   Primitivos: Button, Badge, Input, etc.
                                   Tailwind config compartida
    shared/                     ← Tipos TypeScript compartidos (@andiko/shared)
                                   ContactAttributes, ProductAttributes, etc.
                                   Schemas Zod reutilizables
  pnpm-workspace.yaml
  package.json (workspace root)
```

**Migración del repo actual:**
1. `mkdir -p apps/web && git mv src apps/web/src` (+ mover config files Next.js)
2. Crear `apps/pos/` con Electron + Vite
3. Crear `packages/ui/` extrayendo primitivos de `apps/web/src/components/primitives/`
4. Crear `packages/shared/` con tipos y schemas Zod compartidos
5. Actualizar imports en `apps/web` para apuntar a `@andiko/ui` y `@andiko/shared`

---

## Esquema SQLite local

```sql
products        -- cache de catálogo (id, sku, name, price, iva_rate, synced_at)
customers       -- cache de contactos tipo customer (id, legal_name, trade_name, cuit, email, phone, synced_at)
sales           -- ventas locales (id, customer_id nullable, total, payment_method, status, cloud_id, synced_at)
sale_items      -- ítems de venta (sale_id, product_id, qty, unit_price, total)
sync_queue      -- ventas pendientes de subir (sale_id, attempts, last_error)
license_cache   -- (org_id, branch_id, valid_until, cached_at)
settings        -- (cloud_url, api_token, branch_id, receipt_header, printer_name)
```

---

## Flujo de venta (happy path)

```
1. Cajero busca producto (código de barras o texto → SQLite local)
2. Agrega ítems al carrito → totales calculados localmente
3. Selecciona método de pago (efectivo / tarjeta / transferencia)
4. Confirma → escribe en `sales` + `sale_items` + encola en `sync_queue`
5. Imprime ticket térmico
6. [Background] Worker detecta `sync_queue` pendiente → POST al cloud → marca `synced_at`
```

---

## Modo degradado (sin internet)

| Función | Con red | Sin red |
|---|---|---|
| Vender | ✅ | ✅ (precios del cache) |
| Stock en tiempo real | ✅ | ❌ (sin control de stock) |
| Precios actualizados | ✅ | Cache (puede estar desactualizado) |
| Sync de ventas | Inmediato en background | Cola — sube al reconectar |
| Licencia | Validación online | Grace period: 7 días desde último OK |

---

## Sync de datos maestros (inbound: cloud → local)

Trigger: al iniciar la app + cada 30 minutos (o manual desde settings).

**Productos:**
- `GET /api/v1/pos/products?branch_id=X&since=<timestamp>` — delta por timestamp
- Incluye: id, sku, name, price, iva_rate, is_active
- POS hace upsert por `id`

**Clientes:**
- `GET /api/v1/pos/customers?since=<timestamp>` — solo contactos tipo `customer` o `both`
- Incluye: id, legal_name, trade_name, cuit, email, phone
- POS hace upsert por `id`
- Permite buscar cliente en la pantalla de venta (por nombre o CUIT) antes de cobrar

---

## Sync de ventas (outbound: local → cloud)

- Worker en background (setInterval o IPC) cada 60s
- Lee `sync_queue` con `status = pending`
- `POST /api/v1/pos/sales/sync` — body: array de ventas con ítems
- Cloud crea `SalesOrder` o registro simplificado por cada venta
- POS marca `synced_at` y elimina de la queue
- Reintentos con backoff: 1min → 5min → 15min (máx 3 intentos antes de alertar)

---

## Licencia

- Al iniciar: `GET /api/v1/pos/license?device_id=<uuid>`
- Respuesta: `{ valid: true, org_id, branch_id, valid_until, features: [...] }`
- Guardada en `license_cache` con TTL de 24h
- Si offline y cache vigente (< 7 días): operación normal con banner "modo offline"
- Si cache vencida y sin red: bloqueo con mensaje de soporte
- `device_id`: UUID generado en primer arranque, guardado en electron-store

---

## Nuevos endpoints en Andiko (cloud)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/pos/products` | Catálogo para sync (delta por `since`) |
| GET | `/api/v1/pos/customers` | Clientes para sync (delta por `since`) |
| POST | `/api/v1/pos/sales/sync` | Batch de ventas desde POS |
| GET | `/api/v1/pos/license` | Validación de licencia por device |
| POST | `/api/v1/pos/devices` | Registro inicial del dispositivo |

Todos requieren un **API token de dispositivo** (diferente al token de usuario). Se genera en el admin de Andiko y se configura una sola vez en el POS.

---

## Pantallas del POS (MVP)

1. **Pantalla de venta** — búsqueda, carrito, totales, cobrar
2. **Pantalla de cierre** — resumen del turno, ventas del día, sync status
3. **Configuración** — URL cloud, token, impresora, datos del local
4. **Splash / licencia** — validación en arranque con estado de conectividad

---

## Fases de implementación

### Fase 0 — Monorepo setup
- Crear `pnpm-workspace.yaml` en raíz
- Mover Next.js ERP a `apps/web/`
- Extraer primitivos a `packages/ui/` con re-exports
- Extraer tipos/schemas a `packages/shared/`
- Verificar que `apps/web` compile sin cambios de comportamiento

### Fase 1 — Core local POS (sin sync)
- Setup `apps/pos/` con Electron + Vite + React
- Instalar `@andiko/ui` desde workspace
- SQLite + Drizzle con schema local
- Pantalla de venta completa (productos mock en SQLite, flujo de cobro)
- Impresión de ticket

### Fase 2 — Sync y licencia
- Nuevos endpoints en `apps/web/src/app/api/v1/pos/`
- Worker de sync de ventas (outbound)
- Sync de precios/catálogo (inbound, delta)
- Validación de licencia con grace period

### Fase 3 — Operación y monitoreo
- Dashboard en Andiko para ver POS conectados, últimos syncs, alertas
- Actualizaciones automáticas del POS (electron-updater)

---

## Riesgos y decisiones a tomar

- **Conflictos de precio**: ¿qué precio gana si el cliente compra con precios desactualizados? → registrar el precio al momento de venta (local), cloud no lo modifica retroactivamente.
- **Stock**: MVP sin control de stock local. Andiko descuenta stock cuando la venta llega al cloud.
- **Multi-caja**: ¿puede haber 2 POS en el mismo local? → sí, cada uno con su `device_id` y `branch_id`.
- **Factura electrónica**: fuera del MVP. El ticket es solo un comprobante no fiscal.

---

## Verificación MVP

1. Arrancar POS sin internet → debe mostrar "modo offline" y permitir vender con cache
2. Crear venta → aparece en `sync_queue` con status `pending`
3. Conectar internet → worker sube ventas y aparecen en Andiko cloud como `SalesOrder`
4. Modificar precio en Andiko → después de 30 min (o trigger manual) el POS refleja el nuevo precio
5. Revocar licencia desde admin → POS bloquea al vencer el grace period
