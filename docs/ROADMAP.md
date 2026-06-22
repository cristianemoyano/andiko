# Andiko ERP — Roadmap

ERP modular para PyMEs argentinas. Cada fase es desplegable de forma independiente.
El orden está definido por dependencias de datos y valor de negocio inmediato.

---

## Fase 0 — Fundaciones (en curso)

Infraestructura base sin lógica de negocio.

- [x] Scaffold Next.js 16 + TypeScript + Tailwind
- [x] pnpm, Vitest, ESLint, commitlint, husky, lint-staged
- [x] release-it + conventional changelog
- [x] AGENTS.md + skills de Claude (ship-feature, release, setup-tooling)
- [x] Docker Compose con PostgreSQL 16 + pgAdmin (Colima como engine)
- [x] Makefile con comandos de entorno local (up, down, reset, shell, dev)
- [x] PostgreSQL + Sequelize setup (`src/lib/db.ts`, pool, paranoid, underscored)
- [x] Estructura de módulos (`src/modules/` con contacts, sales, inventory, purchases, accounting, auth)
- [x] Variables de entorno y configuración por ambiente (`src/config/env.ts` con Zod)
- [x] Sistema de migraciones con Umzug (`src/db/migrate.ts`, `pnpm migrate up/down/status`)
- [x] Tipos base compartidos (`src/types/index.ts`)
- [x] Logger estructurado (pino + pino-pretty, `src/lib/logger.ts`)
- [x] Sistema de autenticación (NextAuth v5, JWT, Credentials provider, `src/lib/auth.ts`)
- [x] Migración `users` con roles (admin, operator, readonly), soft delete, UUID
- [x] Middleware de protección de rutas (`src/middleware.ts`)
- [x] Tipos de sesión extendidos con `role` (`src/types/next-auth.d.ts`)
- [x] Página de login (`/login`) con design system, error inline, redirect post-auth
- [x] Rediseño login split-layout con branding Andiko (panel izquierdo + formulario)
- [x] Versión deployada visible en ERP (sidebar, login, landing) vía `NEXT_PUBLIC_APP_VERSION`
- [x] Route groups: `(auth)/` para páginas públicas, `(erp)/` para páginas protegidas
- [x] ERP layout base con auth guard (`src/app/(erp)/layout.tsx`)
- [x] Modelo base de auditoría (`AuditModel`) con `created_by`, `updated_by`, `deleted_by` (FK a `users`), heredado por todos los modelos de negocio
- [x] Multi-tenant foundation: tablas `organizations` + `branches`, `org_id` en `AuditModel` y tablas de contactos, `branch_id` en `users`
- [x] Roles y permisos DB-backed: tablas `permissions` + `role_permissions`, defaults globales, override por organización, `sys-admin` bypass
- [x] `withPermission()` wrapper para route handlers (reemplaza boilerplate de auth manual en los 6 endpoints de contactos)
- [x] `src/lib/permissions.ts` con `can()`, `requirePermission()`, `ForbiddenError`, deduplicación con React `cache()`
- [x] Sesión extendida: `role`, `orgId`, `branchId` en JWT y session callbacks
- [x] Página de perfil de usuario (`/perfil`): nombre, email, rol, org, sucursal; edición de nombre/contraseña vía `/api/v1/me/profile`
- [x] Permiso `panel:read` en matriz de roles; acceso al panel para Gerente y Encargado de sucursal
- [x] Capabilities-driven UI: navegación, tabs de configuración y secciones de organización según permisos efectivos
- [x] Roles custom por org (`org_roles`) + matriz de permisos editable; rol built-in `branch-admin` (Encargado de sucursal)
- [x] Permisos `settings:read/write` para administración de org (usuarios, sucursales, matriz) sin bypass sys-admin
- [x] Admin de organización unificado en `/organizaciones/[id]` (namespace API `settings` para Gerente)
- [x] Impersonación sys-admin: identidad efectiva en sesión, capabilities y perfil del usuario impersonado
- [x] UX: componente global de error de API (banner/toast) + helper `fetchJson` para evitar duplicar manejo de errores en cada pantalla
- [x] Dev tooling: comandos de seed/clear idempotentes creciendo con el sistema (incluye permisos, catálogo, ventas, tenancy)
- [x] Prod DB CLI: `db:reset-prod`, `migrate:prod`, `migrate:baseline-prod`, `db:seed-prod` (local, con `.env.production.local`)
- [x] Landing pública "Próximamente" en `/` con SEO (metadata, sitemap, robots, OG image, JSON-LD)
- [x] Panel ERP movido a `/panel`; redirects post-login y onboarding actualizados
- [x] Formulario de contacto en landing vía Web3Forms (`ContactForm`, sin BD)
- [x] Landing de producto completa en `/` (desde diseño Claude Design): header sticky + nav con smooth-scroll, hero con mockup denso del panel ERP (`DashboardMockup`), secciones Módulos / Por qué / Métricas + rubros / Beta privada, footer. Lenguaje visual de marketing (botones 4px, tarjetas 12px, badges pill, foco teal) distinto del UI de producto.
- [ ] Mencionar el módulo POS en la landing (ausente en el diseño actual; pendiente decidir tarjeta/copy)

---

## Fase DS — Design System

Biblioteca de componentes reutilizables documentada en Storybook.
Arranca en paralelo con Fase 1 y crece a medida que cada módulo necesita UI.
Ningún componente se usa en producción sin su story.

**Stack:** Storybook 10, Tailwind, Radix UI (primitivas accesibles), `class-variance-authority` (variantes).  
**Ubicación:** `src/components/` — nunca dentro de `src/modules/`.

### Setup
- [x] Storybook 10 configurado con Next.js + Tailwind (`pnpm storybook`)
- [x] `src/components/` con estructura por categoría (primitives, layout, erp)
- [x] `src/lib/utils.ts` — helper `cn()` (clsx + tailwind-merge)
- [ ] Chromatic para visual regression testing (fase posterior)

### Theming
- [x] Soporte light/dark/system con `next-themes` y CSS variables semánticas
- [x] Tokens de color con `@theme inline` (swappable en `.dark`) — `bg`, `surface`, `fg`, `border`, `ring`, danger, success, warning
- [x] Selector Light/Dark/System en Configuración (persistido en localStorage)
- [x] Refactor 150+ archivos (components + ERP pages) de colores hardcodeados a tokens semánticos
- [x] Documentos fiscales (print) pinned a light mode para garantizar AFIP compliance

### Primitivas base
- [x] Button (variantes: primary, secondary, ghost, danger; tamaños: sm, md, lg)
- [x] Input (estados: error, disabled, readonly)
- [x] FormField (label + control + mensaje de error, Radix Label)
- [x] Select / Combobox (búsqueda, multi-select)
- [x] Textarea
- [x] Checkbox y Switch
- [x] Badge / StatusBadge (para estados de documentos ERP)
- [x] Tooltip
- [x] Modal / Dialog (con focus trap, Radix Dialog)
- [x] Dropdown Menu

### Componentes de layout
- [x] TopBar / PageHeader (breadcrumb + slot de acciones)
- [x] Card / Panel
- [x] Sidebar (navegación principal, logout, estado activo)
- [x] Tabs
- [x] Responsive móvil (<768px): barra de navegación inferior con Panel · Ventas · Productos · Menú (4 tabs, íconos más grandes); drawer "Menú" con el resto de módulos; Dialog con scroll y gutters; grillas de formulario/detalle que colapsan a una columna
- [x] PWA instalable: manifest + íconos de marca (192/512/maskable/apple-touch), `theme-color` y meta iOS web-app, display `standalone` (sin chrome del navegador); service worker estático que cachea solo assets inmutables de `/_next/static` (cache-first) y nunca HTML ni `/api/*` para no servir datos financieros desestabilizados; banner de instalación descartable (prompt Android + hint "Agregar a inicio" iOS); safe-area superior e inset de overscroll para modo standalone
- [x] Skeleton primitive (placeholders animados) reemplazando el texto "Cargando…" en el Panel

### Componentes ERP-específicos
- [x] DataTable (columnas configurables, sorting client-side, row actions; layout lista mobile estilo WooCommerce en <768px)
- [x] TablePagination (anterior / siguiente y página actual, para tablas con datos paginados)
- [x] CurrencyInput (formato ARS: `$ 1.234,56`, edición en coma decimal, `Decimal.js`-safe)
- [x] DateInput (formato DD/MM/YYYY, automask, parse/format UTC)
- [x] SearchableSelect (estático y async con debounce 300ms, Radix Popover, sublabel)
- [x] TotalsFooter (subtotal / IVA desglosado por alícuota / total)
- [x] EmptyState (pantalla vacía con acción primaria e ícono configurable)
- [x] ConfirmDialog (danger/warning, loading state, Radix Dialog)
- [x] FormField (label + input + mensaje de error — envuelve cualquier control)
- [x] Sparkline (Recharts LineChart sin ejes, para KPI cards)
- [x] PanelBarChart (Recharts BarChart con estilos Andiko, tooltip ARS, toggle período)
- [x] PanelDonutChart (Recharts PieChart con leyenda y hover)
- [x] PerformanceCard (tarjeta hero del panel: tabs Total/Cobrado/Pendiente, KPIs secundarios, gráfico área, link a reportes)

### Principios del design system
- Accesibilidad primero: todos los componentes deben ser navegables por teclado y compatibles con lectores de pantalla.
- Densidad de información alta: ERP, no landing page. Tablas compactas, formularios en columnas.
- Sin animaciones innecesarias. Transiciones solo donde ayudan a orientar al usuario.
- Cada componente tiene: story de estados, story de edge cases, y props documentadas en Storybook.

---

## Panel General (Dashboard)

Vista ejecutiva del negocio. Primer pantalla post-login.

- [x] KPI cards: Facturado, Cobrado, Cuentas por cobrar, Saldo en cuenta (con sparklines y tendencia vs período anterior)
- [x] Count cards: Productos activos, Clientes, Proveedores, Comprobantes del período
- [x] Flujo de caja — gráfico de barras con toggle Semanal / Mensual / Anual
- [x] Gastos por proveedor — gráfico donut con top 6 proveedores del período
- [x] Facturas recientes — últimas 5 con número, cliente, fecha, total y estado
- [x] Actividad reciente — feed de eventos con tiempo relativo
- [x] Filtro por período: Última semana / Último mes / Últimos 3 meses / Último año / Personalizado (date range)
- [x] Filtro por sucursal: todas o sucursal específica
- [x] Filtros persistidos en URL params (links compartibles, survive refresh)
- [x] Widgets de alertas de stock en dashboard: productos vencidos, próximos a vencer (7 días), bajo stock mínimo — con links al listado filtrado
- [x] Actividad reciente: ampliar con eventos de stock, pagos y compras (hoy solo facturas)
- [x] PerformanceCard hero: tabs Total/Cobrado/Pendiente, gráfico de área, KPIs secundarios
- [x] Analytics estilo WooCommerce: Ingresos, Pedidos, Mejores productos (con tooltips en KPIs)
- [x] Personalización de widgets: botón Editar → show/hide + reordenar tarjetas, persistido en `users.preferences`
- [x] Tooltips de ayuda en KPIs del panel (desktop y analytics)
- [x] Dark mode: contraste en Select de período y acentos brand (links, gráficos)
- [ ] Exportar dashboard como PDF con template dedicado (removido export rápido vía print)
- [x] PanelFilterBar: filtro de período en Select + sucursal + personalizar layout (mobile-first)
- [x] Queries del panel optimizadas (CTEs en lugar de subqueries correlacionadas; 13→7 round-trips SQL)
- [x] Cache in-memory 60s en endpoints del panel (`/kpis`, `/recent-invoices`, `/activity`)
- [x] Migración: índices compuestos para reportes del panel (`issue_date`, `payment_date`, `updated_at`)

---

## Fase 1 — Contactos

Base de datos de clientes y proveedores. Dependencia de todos los módulos siguientes.

**Entidades:** `contacts`, `contact_addresses`, `contact_payment_info`

### Backend (completado)
- [x] Migración `contacts`, `contact_addresses`, `contact_payment_info` con ENUMs PostgreSQL
- [x] Modelo Sequelize `Contact` con tipos estrictos (`ContactType`, `IvaCondition`)
- [x] Validación de CUIT (algoritmo de verificación mod 11 con dígito verificador)
- [x] Schemas Zod: create, update (partial), query (page/limit/search/type)
- [x] Service: `listContacts` (paginado, búsqueda por nombre/trade_name/cuit, filtro por tipo)
- [x] Service: `getContact`, `createContact`, `updateContact`, `deleteContact` (soft delete)
- [x] Campos de persona de contacto en `contacts` (`first_name`, `last_name`, `job_title`) y búsqueda en listado
- [x] Dato de pago `is_default` (a lo sumo un principal por contacto: transacción + índice único parcial)
- [x] API REST: `GET /api/v1/contacts`, `POST /api/v1/contacts`
- [x] API REST: `GET /api/v1/contacts/:id`, `PATCH /api/v1/contacts/:id`, `DELETE /api/v1/contacts/:id`
- [x] Tests unitarios para `contact.utils.ts` (validateCuit, formatCuit, `formatContactPersonLabel`)

### Frontend
- [x] TopBar con breadcrumb (componente de layout reutilizable)
- [x] Listado de contactos con DataTable (búsqueda por nombre/CUIT, filtro por tipo, paginación)
- [x] Columna y formulario: persona de contacto (nombre, apellido, puesto)
- [x] Modal crear/editar contacto con validación inline y manejo de errores de API
- [x] Campo `is_active` editable en modal de edición
- [x] Eliminación de contacto con confirmación desde el modal de edición
- [x] Vista detalle de contacto (`/contactos/[id]`) con secciones de datos fiscales y de contacto
- [x] Breadcrumb `Contactos › Razón social` con navegación de vuelta al listado
- [x] Datos de pago: CBU, alias, banco (CRUD desde vista detalle, validación de 22 dígitos, dato principal)
- [x] Múltiples direcciones por contacto (entrega, fiscal, comercial) con CRUD desde vista detalle
- [x] Importación desde CSV

---

## Fase 2 — Catálogo

Productos y servicios. Requisito mínimo para facturar.

**Entidades:** `products`, `product_categories`, `price_lists`, `price_list_items`

- [x] ABM de productos y servicios
- [x] Categorías y subcategorías
- [x] Unidades de medida (kg, unidad, hora, etc.)
- [x] Código interno y código de barras
- [x] Alícuota IVA por producto (0%, 10.5%, 21%, 27%)
- [x] Listas de precios (múltiples listas por cliente/canal)
- [x] Historial de precios
- [x] Etiquetas de góndola — pantalla de selección masiva por categoría, impresión browser-native (CSS @media print)
- [x] Ajustes masivos de precios (por categoría / % / canal) y reglas
- [x] Datos de logística / shipping por SKU (peso, dimensiones, bultos/presentaciones)

---

## Multitenancy & Tenancy Admin (en curso)

Trabajo transversal para garantizar aislamiento fuerte por `org_id` y `branch_id`, y un panel sys-admin para administrar organizaciones/sucursales/usuarios.

### Panel sys-admin (completado)
- [x] `/sys-admin/organizaciones` — listado de orgs, crear/editar/eliminar
- [x] `/sys-admin/organizaciones/[id]` — detalle con sucursales y usuarios de la org
- [x] CRUD de sucursales por org (nombre, dirección, `branch_code`)
- [x] CRUD de usuarios por org: email, rol, contraseña, PIN POS, asignación de sucursales (`user_branches`), sucursal default
- [x] `requireSysAdmin` guard en todas las rutas sys-admin
- [x] `user_branches` ya operativo en `TenantContext` para filtrado por sucursal

### Pendientes
- [x] Campos fiscales de org en UI sys-admin (CUIT, razón social legal, condición IVA, domicilio fiscal)
- [x] `organization_settings` (enabled_modules/features) + guards por módulo/feature
- [x] Policy de lecturas: enforzar `user_branches` también en lecturas (no solo en writes)
- [x] Enforcements DB: índices/uniques scoped (`UNIQUE(org_id, ...)`) en entidades relevantes
- [x] Definir mapa base vs premium e integrarlo con `organization_settings`

---

## Fase 3 — Ventas

Flujo principal de negocio: presupuesto → pedido → factura → cobro.
Sin integración AFIP en esta fase — documentos internos únicamente.

**Entidades:** `sales_quotes`, `sales_orders`, `invoices`, `invoice_items`, `payments`

### Backend (completado)
- [x] Migraciones: `document_sequences`, `sales_quotes`, `sales_quote_items`, `sales_orders`, `sales_order_items`, `invoices`, `invoice_items`, `payments`
- [x] Modelos Sequelize con tipos estrictos para los 7 modelos (SalesQuote, SalesQuoteItem, SalesOrder, SalesOrderItem, Invoice, InvoiceItem, Payment)
- [x] Numeración automática de documentos por org (`PRES-NNNN`, `PED-NNNN`, `FAC-NNNN`, `COB-NNNN`) con secuencias atómicas (`ON CONFLICT DO UPDATE`)
- [x] Cálculo de IVA discriminado por alícuota (0%, 10.5%, 21%, 27%) con `Decimal.js` — sin float math
- [x] Descuentos por ítem con base imponible calculada antes de IVA
- [x] Condiciones de pago (contado, 30/60/90 días) con cálculo automático de `due_date`
- [x] Schemas Zod con tipos estrictos, fechas parseadas a `Date`, constantes de enum exportadas
- [x] Service presupuestos: CRUD + conversión `quote → order` (requiere status `accepted`)
- [x] Service pedidos: CRUD + conversión `order → invoice` (requiere status `confirmed | in_progress`)
- [x] Service facturas: CRUD + `issueInvoice` + `cancelInvoice` con transición de estados explícita
- [x] Service cobros: CRUD + `recalcInvoiceBalance` (recalcula `paid_amount`, `balance`, `status` atomicamente)
- [x] API REST: `quotes`, `orders`, `invoices`, `payments` — CRUD + acciones de estado
- [x] Endpoints de conversión: `POST /quotes/:id/convert`, `POST /orders/:id/convert`
- [x] Endpoints de estado: `POST /invoices/:id/issue`, `POST /invoices/:id/cancel`
- [x] Permisos `sales:read / sales:write / sales:delete` — ya presentes en DB desde Fase 0
- [x] Tests unitarios: `calcLineItem`, `calcDocumentTotals`, `issueInvoice`, `cancelInvoice`, `createPayment` (48 assertions)

### Frontend
- [x] Presupuestos con vigencia y estado (listado + detalle + modal)
- [x] Conversión presupuesto → pedido → factura en un flujo (UI en detalle + navegación entre secciones)
- [x] Descuentos por ítem (modales de líneas; descuento a nivel documento según backend en totales)
- [x] Registro de cobros parciales y totales (UI en detalle de factura + listado de cobros)
- [x] Estados de factura: borrador, emitida, cobrada, anulada (UI listado + emitir / anular / cobros en detalle)
- [x] Rediseño UX Ventas — fase 1: `DatePicker` real con calendario (Radix Popover + react-day-picker)
- [x] Rediseño UX Ventas — fase 2: API `GET /api/v1/catalog/products/for-sale` con precio efectivo por lista
- [x] Rediseño UX Ventas — fase 3: `order_id` requerido en facturas (NOT NULL + Zod); conversión solo desde `delivered`; `price_list_id` en presupuestos, pedidos y facturas
- [x] Rediseño UX Ventas — fase 4: `SalesLineItemsEditor` (búsqueda de producto con autocomplete de precio/IVA) + `StatusPipeline` (stepper horizontal por tipo de documento)
- [x] Rediseño UX Ventas — fase 5: formularios de página completa para nuevo presupuesto y nuevo pedido; vistas de detalle rediseñadas con `StatusPipeline` + edición in-place + transiciones de estado; listas navegan a `/[id]` al hacer click; eliminación de InvoiceModal/OrderModal/QuoteModal
- [x] Notas de crédito internas — NC-XX-NNNN, borrador → emitida → anulada; aplica automáticamente al saldo de factura vinculada; aparece en cuenta corriente del cliente
- [x] Listado de cuentas corrientes por cliente
- [x] Reportes: ventas por período, por cliente, por producto
- [x] **Impresión y exportación de documentos (MVP)** — Módulo `printing` (registro por dominio/recurso), API `GET /api/v1/printing/[domain]/[resource]/[id]`, vistas print bajo `/ventas/...` y `/compras/...` (layout A4, PDF vía `window.print()` + `@media print`). Borradores imprimibles con marca **BORRADOR** (uso interno).
- [x] Templates configurables por organización: logo, colores, datos fiscales (CUIT, IVA, domicilio), pie de página. *(Editor en `/configuracion`, link en sidebar, validación Zod + merge sobre defaults.)*
- [x] Editor visual de template (tipografía, paleta, secciones visibles). *(Vista previa en vivo del documento mientras se edita.)*

---

## Fase 4 — Inventario

Gestión de stock integrada con ventas y compras.

**Entidades:** `warehouses`, `stock_items`, `stock_movements`

### Backend (completado)
- [x] Migraciones: `warehouses`, `stock_items`, `stock_movements` + `variant_id` en ítems de venta
- [x] Modelos Sequelize con tipos estrictos: `Warehouse`, `StockItem`, `StockMovement`
- [x] `warehouses.service.ts`: CRUD + `resolveDefaultWarehouse` (fallback sucursal → org)
- [x] `stock-movements.service.ts`: `applyMovement` (ledger atómico con lock), `deductStockForOrder`, `restoreStockForOrder`, `manualAdjustment`, `listMovements`
- [x] `stock-items.service.ts`: `getStockLevels` (paginado + filtros de alertas), `getVariantStock`, `updateStockItemAlerts`
- [x] Integración con ventas: descuento automático al confirmar pedido, restauración al cancelar pedido y al anular factura
- [x] `variant_id` propagado en `SalesOrderItem`, `SalesQuoteItem`, `InvoiceItem` (modelos + schemas Zod + tipos frontend)
- [x] API REST: `GET/POST /api/v1/inventory/warehouses`, `GET/PATCH/DELETE /api/v1/inventory/warehouses/[id]`, `GET` + `PATCH /api/v1/inventory/stock`, `GET/POST /api/v1/inventory/movements`
- [x] Tests unitarios: `applyMovement` (happy path, stock insuficiente, ítem nuevo), `restoreStockForOrder`, `manualAdjustment` (delta positivo, negativo y cero), `getStockLevels` / `updateStockItemAlerts`

### Frontend
- [x] Módulo `/inventario` con sub-nav (Depósitos / Stock / Movimientos)
- [x] Depósitos múltiples: listado + CRUD modal + detalle con stock y movimientos por depósito
- [x] Ajuste manual de stock desde detalle de depósito
- [x] Vista global de stock variante × depósito (`/inventario/stock`)
- [x] Historial de movimientos global con filtros (`/inventario/movimientos`)
- [x] Vista de stock por variante con nombre de producto (en lugar de UUID)
- [x] Alertas de stock mínimo y vencimiento MVP (`minimum_quantity` + `expires_on` por variante×depósito; UI + filtros)
- [x] Stock UI: leer filtros desde URL params al montar (para deep-links desde dashboard)
- [x] Lista de reposición por depósito: productos con stock ≤ mínimo, cantidad sugerida, exportación CSV (`/inventario/reposicion`)

### Pendientes
- [x] Remitos de entrega
- [x] Trazabilidad por lotes (lote + vencimiento por cantidad) con salidas FEFO y vínculo explícito en `stock_movements`

---

## Fase 5 — Compras

Ciclo de compras: orden → recepción → factura proveedor → pago.

**Entidades:** `purchase_orders`, `purchase_receipts`, `supplier_invoices`, `supplier_payments`

### Backend (completado)
- [x] Migraciones: `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_items`, `supplier_invoices`, `supplier_invoice_items`, `supplier_payments`
- [x] Modelos Sequelize con tipos estrictos para los 7 modelos
- [x] Numeración automática de documentos por org+sucursal (OC-, REC-, FP-, PAG-) con secuencias atómicas
- [x] Cálculo de IVA discriminado + descuentos con `Decimal.js`
- [x] Condiciones de pago con cálculo automático de `due_date`
- [x] Schemas Zod para todos los recursos
- [x] Service órdenes de compra: CRUD + cambio de estado (`draft → sent → partially_received → received`)
- [x] Service recepciones: CRUD + `confirmPurchaseReceipt` (aplica stock via `applyMovement`, actualiza `received_qty` en ítems de OC, recalcula estado de la orden)
- [x] Service facturas proveedor: CRUD + `receiveInvoice` + `cancelInvoice`
- [x] Service pagos a proveedor: CRUD + `recalcInvoiceBalance` (recalcula `paid_amount`, `balance`, `status`)
- [x] API REST: `purchase-orders`, `purchase-receipts`, `supplier-invoices`, `supplier-payments` — CRUD + acciones de estado
- [x] Integración inventario: recepción confirmada → `applyMovement` en depósito destino

### Frontend (completado)
- [x] Módulo `/compras` con sub-nav (Órdenes / Recepciones / Facturas / Pagos)
- [x] Listado + detalle de órdenes de compra con acciones de estado
- [x] Creación de recepción desde orden (pre-completa proveedor, ítems y cantidades pendientes)
- [x] Listado + detalle de recepciones con confirmación (actualiza stock)
- [x] Listado + detalle de facturas de proveedor con registro de pagos parciales
- [x] Listado de pagos a proveedores

### Pendientes
- [x] Cuenta corriente proveedor — `/compras/cuenta-corriente` con historial de facturas + pagos, saldo, vencido y filtros por período (mismo patrón que ventas CC)
- [x] Conciliación orden → recepción → factura (alertas de diferencias de precio/cantidad)
- [x] Reportes: compras por período, por proveedor, por categoría de producto

---

## Fase 6 — AFIP / Facturación Electrónica

Integración con AFIP para emisión de comprobantes electrónicos.
Se construye sobre el módulo de Ventas ya estable.

Backend completo y testeado; transporte WSAA/WSFE vía `@ramiidv/arca-facturacion`
detrás de un adaptador mockeable (`AFIP_MODE=stub|homologacion|produccion`).

### Backend (completado)
- [x] Integración con AFIP vía WSFE — adaptador `WsfeClient` (stub + real `@ramiidv/arca-facturacion`)
- [x] Autenticación con certificado digital (WSAA) — firma local en el SDK, selección por `AFIP_MODE`
- [x] Emisión de Facturas A, B, C electrónicas — clasificación por condición IVA emisor/receptor
- [x] Notas de crédito y débito electrónicas — modelo `debit_notes` + servicio + `CbtesAsoc`
- [x] Obtención y almacenamiento de CAE — `cae`, `cae_expiration`, `punto_venta`, `cbte_numero`, `afip_status`
- [x] Manejo de contingencias — cola `afip_emissions` con reintento/sincronización idempotente
- [x] Libro IVA Ventas digital — servicio + endpoint (`/api/v1/afip/libro-iva-ventas`)
- [x] Libro IVA Compras digital — servicio + endpoint (`/api/v1/afip/libro-iva-compras`)
- [x] Punto de venta por sucursal + endpoint de configuración AFIP
- [x] Certificados ARCA por organización — bóveda `afip_credentials` (clave privada cifrada), validación X.509 y API de carga (PEM) con estado redactado

### Frontend (completado)
- [x] Componentes de diseño `AfipStatusBadge` y `AfipDocumentPanel` (con Storybook)
- [x] Acción "Autorizar AFIP" + panel CAE/estado en detalle de factura, nota de crédito y nota de débito
- [x] Pantallas de notas de débito (listado, alta, detalle)
- [x] Páginas Libro IVA Ventas (`/ventas/libro-iva`) y Compras (`/compras/libro-iva`) con filtro por período
- [x] Pestaña de configuración AFIP: punto de venta por sucursal, carga de certificado ARCA (PEM) y cola de contingencia
- [x] Reimpresión de comprobantes con CAE + QR (RG 4291) en plantilla de impresión

---

## Fase 7 — Contabilidad

Módulo contable básico. Depende de todos los módulos anteriores.

**Entidades:** `accounts`, `journal_entries`, `journal_entry_lines`

- [x] Plan de cuentas (adaptado a PyMEs argentinas) — sembrado por defecto, editable
- [ ] Asientos automáticos desde ventas, compras y pagos
- [x] Asientos manuales — partida doble, débito/haber balanceado, estados borrador/contabilizado
- [x] Balance de sumas y saldos — con filtro por sucursal (centro de costo)
- [ ] Estado de resultados
- [ ] Cierre de período
- [ ] Exportación para estudio contable

> Dimensión de sucursal (centro de costo) opcional a nivel de línea de asiento: los libros se mantienen a nivel empresa (CUIT).

---

---

## Comunicaciones / Email

Envío de documentos e notificaciones por email desde el ERP.

### Backend (completado)
- [x] Migraciones: `email_logs`, tabla singleton `platform_settings` (SMTP global), columna `email_templates` en `organization_settings`
- [x] Servicios: config SMTP **global/plataforma** (`email-settings.service` → `platform_settings`), templates por org (`email-templates.service`), transporte SMTP/log (`transport.ts`), resolución de documento (`document-resolver.ts`), cifrado de secretos (`crypto.ts`, AES-256-GCM derivado de `AUTH_SECRET`)
- [x] Modelo `EmailLog` + historial por documento; modelo `PlatformSetting`
- [x] API REST: `GET/PUT /api/v1/sys-admin/email-settings` (SMTP global, `requireSysAdmin`), `GET/PUT /api/v1/communications/templates`, `POST /api/v1/communications/send`, `GET /api/v1/communications/logs`, `GET /api/v1/communications/logs/[id]`

### Frontend (completado)
- [x] Configuración SMTP **a nivel sys-admin/plataforma** (no por org) — pantalla `/sys-admin/email` + link en sidebar; contraseña cifrada, nunca devuelta al cliente. La usan todas las organizaciones.
- [x] Test de email desde `/sys-admin/email` — `POST /api/v1/sys-admin/email-settings/test` + `sendTestEmail` (usa la config guardada; no persiste en `email_logs`); errores SMTP_NOT_CONFIGURED (409) / EMAIL_TEST_FAILED (502)
- [x] Preset rápido "Usar Gmail" en `/sys-admin/email` (smtp.gmail.com:465 SSL, sincroniza usuario↔remitente) + ayuda de contraseña de aplicación
- [x] Toggle mostrar/ocultar (`PasswordInput`) en campos de contraseña SMTP y de usuario/PIN POS (`OrgUserModal`)
- [x] Templates de email por tipo de documento (presupuesto, pedido, factura, remito) — editor UI por org en `/configuracion` (tab "Plantillas de email") + defaults con variables `{{contact_name}}`, `{{document_number}}`, `{{total}}`, etc.
- [x] Envío de documentos al cliente desde el detalle (componente `SendDocumentEmail`: botón "Enviar por email" en facturas/pedidos/presupuestos) + servicio de envío que persiste `email_logs`
- [x] Historial de envíos por documento — listado en el diálogo de envío
- [x] Bandeja de auditoría **Emails enviados** por organización — tab en `/configuracion` con listado paginado, filtros y detalle del contenido renderizado guardado
- [x] Persistencia de contenido en `email_logs` (`body_text`, `body_html`, `transport`, `message_id`) para envíos nuevos

### Pendiente
- [ ] Notificaciones internas: alertas de stock mínimo, vencimiento de presupuestos *(requiere scheduler/cron — fase posterior)*

---

## POS — Punto de venta offline (Electron + SQLite)

App de escritorio para locales físicos. Sincronización eventual con el cloud ERP.

### Infraestructura monorepo
- [x] `pnpm-workspace.yaml` — workspace con `apps/*` y `packages/*`
- [x] `apps/pos/` — app Electron + Vite + React + SQLite (better-sqlite3)
- [x] `packages/ui/` — componentes compartidos `@andiko/ui`
- [x] `packages/db/` — tipos compartidos `@andiko/db`

### Backend cloud (Next.js API)
- [x] Tabla `pos_devices` — `device_id`, `api_token`, `branch_id`, `license_valid_until`, `is_active`
- [x] Migración `create-pos-devices` con índice único `(org_id, device_id)` y fix posterior
- [x] `pos_pin_hash` en `users` — PIN numérico hasheado para autenticación de cajeros en POS
- [x] Migración `add-pos-pin-to-users`
- [x] `source` en `sales_orders` — enum `erp | pos` para trazabilidad de ventas POS
- [x] Migración `add-pos-traceability-to-sales-orders`
- [x] `withPosDevice()` — middleware de auth por Bearer token (valida device activo, bumps `last_seen_at`)
- [x] `GET /api/v1/pos/devices` — listado de dispositivos por org (ERP admin)
- [x] `POST /api/v1/pos/devices` — alta de dispositivo con `api_token` aleatorio
- [x] `PATCH /api/v1/pos/devices/:id` — editar nombre, branch, licencia, estado
- [x] `DELETE /api/v1/pos/devices/:id` — soft delete
- [x] `GET /api/v1/pos/license` — info de licencia + org/branch para el dispositivo autenticado
- [x] `GET /api/v1/pos/products` — catálogo con variantes y precio efectivo (delta por `since`)
- [x] `GET /api/v1/pos/customers` — clientes con delta por `since`
- [x] `GET /api/v1/pos/users` — cajeros autorizados con `pos_pin_hash` (delta por `since`)
- [x] `POST /api/v1/pos/sales/sync` — batch de ventas offline → `sales_orders` con trazabilidad POS

### Frontend ERP (gestión de dispositivos)
- [x] `/pos/dispositivos` — listado de dispositivos con estado de licencia
- [x] Modal alta/edición de dispositivo (`DeviceEditModal`) con renovación de licencia
- [x] Sidebar: sección POS con link a Dispositivos

### Build y distribución
- [x] `electron-builder` configurado — DMG para macOS (x64 + arm64), NSIS installer para Windows x64
- [x] GitHub Actions workflow (`pos-release.yml`) — build nativo por plataforma, publish a repo público `andiko-pos-releases` vía tag `pos/v*`
- [x] Versión de la app inyectada en build-time (`__APP_VERSION__`) y mostrada en la UI
- [ ] Íconos de la app (`resources/icon.icns`, `icon.ico`) — pendiente diseño
- [ ] Firma de código macOS (Apple Developer ~USD 99/año) — necesario para clientes no técnicos
- [ ] Firma de código Windows (Authenticode EV ~USD 300-500/año) — elimina SmartScreen warning
- [ ] `electron-updater` — auto-update en background desde repo público (requiere firma de código en macOS)

### Pendientes
- [x] Barcode sync — `barcode` incluido en `PosProduct` y en payload de sync cloud→POS
- [x] Barcode search — búsqueda por match exacto de barcode en POS (compatible con lectores HID)
- [x] Cierre de caja — pantalla con totales del día por método de pago (efectivo, tarjeta, transferencia)
- [x] Modo pantalla completa — fullscreen en producción, F11 para toggle
- [x] Listas de precios en POS — endpoint `/api/v1/pos/products` resuelve precio desde lista default del ERP
- [x] Gestión de turnos (cash sessions) — apertura con monto inicial, cierre con conteo físico + diferencia automática, sync cloud
- [x] `POST /api/v1/pos/cash-sessions/sync` — batch sync de turnos POS → `pos_cash_sessions`
- [x] `GET /api/v1/pos/cash-sessions` — historial de turnos con filtros (estado, rango de fechas, sucursal)
- [x] `/pos/cajas` — vista ERP de turnos de caja con tabla, filtros y paginación
- [x] Medios de pago dinámicos — `pos_payment_methods` + `pos_branch_payment_methods`; configurables desde ERP por org/sucursal, sincronizados al POS; reemplaza `payment_method` fijo por `payments[]` con soporte mixto a futuro
- [x] `GET /api/v1/pos/payment-methods` — endpoint POS-device: métodos activos para la sucursal del dispositivo
- [x] `GET/POST /api/v1/pos/org-payment-methods` + `PATCH/DELETE /api/v1/pos/org-payment-methods/:id` — CRUD ERP para administrar métodos de pago
- [x] `/pos/medios-de-pago` — pantalla ERP: gestión de métodos con asignación por sucursal
- [x] Código de operación opcional en checkout para medios no-efectivo (guardado en `payments[].reference`)
- [x] Apertura y cierre de turno de caja requieren PIN del cajero
- [x] Cancelación de venta en borrador con modal de confirmación (atajo Cmd/Ctrl+⌫)
- [x] Zona de peligro en Settings: limpiar datos locales de dev
- [x] Botón manual "Enviar ventas pendientes al cloud" en Settings
- [x] Sync de ventas/turnos: errores visibles por registro; `salesperson_id`/`cashier_user_id` verificados contra cloud antes de usar como FK
- [x] `GET /api/v1/pos/sales/sync` — pull de ventas sincronizadas (para reconciliación offline)
- [x] Renovación de licencia desde el ERP admin (extender `license_valid_until`)
- [x] App Electron: sincronización automática en background cuando hay conexión
- [x] Ticket fiscal POS (80 mm): encabezado org/sucursal, Tique cód. 083, transparencia fiscal, defensa del consumidor
- [x] `POST /api/v1/pos/sales/register` — registro de venta POS en cloud (`sales_orders`) sin CAE
- [x] `POST /api/v1/pos/sales/authorize` — autorización AFIP (WSFE) con CAE, número fiscal y QR
- [x] Checkout desacoplado: venta local aunque falle AFIP; reintento desde Ventas → Autorizar AFIP
- [x] Config fiscal en ERP: IIBB, inicio actividades, PV por dispositivo, pie de ticket POS
- [x] QR AFIP en ticket (SVG inline) + vuelto en efectivo (`tendered_amount`)
- [x] Rol org `cajero` + elegibilidad de cajeros POS (`pos-cashier-eligibility`)
- [x] Balanzas: PLU / venta por peso, barcode EAN-13 pesable, sync config desde license API
- [x] Branding white-label en POS: monograma de org, paleta `brand`, co-branding Andiko discreto
- [x] Pantalla de venta ticket-first: escaneo/búsqueda bajo demanda (sin grid de catálogo completo)
- [x] Panel lateral de cobro con branding Andiko ERP (slot `promo` para publicidades futuras)
- [x] Tipografía ampliada y header con cajero, org y estado de conexión

## Fase 8 — Integraciones de Hardware

Hardware especializado para casos de uso específicos (retail, almacenes).

### Balanzas Digitales (Mettler Toledo, CAS, Dibal, etc.)

**Caso de uso primario:** Retail de productos a granel (carnicería, verdulería, panadería, almacén) con pesaje en POS.

**Caso de uso secundario:** Control de peso en recepción de compras (vs. cantidad ordenada).

**Stack:** Comunicación RS-232/USB/TCP desde Electron, variantes dinámicas por peso.

#### Backend
- [ ] Migraciones: `scale_devices` (config por sucursal), `scale_readings` (historial de pesajes)
- [ ] Modelo Sequelize `ScaleDevice` (device_type, connection_type, connection_config JSONB, is_active, last_connected_at)
- [ ] Modelo Sequelize `ScaleReading` (device_id, weight_grams, timestamp, opcional sale_order_item_id)
- [ ] Service `scale-devices.service.ts`: CRUD + validación de config por tipo
- [ ] Service `scale-readings.service.ts`: logging de pesajes, estadísticas
- [ ] API REST: `GET/POST /api/v1/pos/scale-devices`, `PATCH/DELETE /api/v1/pos/scale-devices/:id`, `GET /api/v1/pos/scale-readings`
- [ ] `withScaleDevice()` middleware para rutas POS que usan balanza

#### POS (Electron)
- [ ] `apps/pos/src/scales/ScaleReader.ts` — abstracción de comunicación (RS-232 serial, TCP socket)
  - `ScaleReaderRS232` (serial-port library)
  - `ScaleReaderTCP` (raw socket)
  - Interfaz común `IScaleReader`
- [ ] `apps/pos/src/hooks/useScaleWeight()` — hook para leer peso en vivo (estabilidad de lectura, timeout)
- [ ] Componente `<ScaleWeightDisplay />` (mostrando peso actual, estatus conexión)
- [ ] Modal de configuración: seleccionar balanza, puerto COM / IP, baudrate, timeout
- [ ] En checkout: opción "Pesar" para productos con variante por peso (kg, 100g, etc.)
- [ ] Lectura de peso → pre-llena cantidad en línea de venta, calcula precio dinámicamente
- [ ] UX: botón "Leer peso" o automático al enfocar campo de cantidad
- [ ] Historial local de pesajes (para debugging, sincroniza a cloud)

#### ERP Admin
- [ ] `/pos/balanzas` — pantalla CRUD de dispositivos por sucursal (test conexión, historial de pesajes)
- [ ] Estado de conexión en tiempo real (last_connected_at, latencia promedio)
- [ ] Logs de errores por dispositivo (puerto no disponible, timeout, parsing error)

#### Testing
- [ ] Mock de `ScaleReader` para tests (simular pesajes)
- [ ] Casos edge: timeout, lectura inestable, reconexión, cambio de puerto COM
- [ ] Integración POS: flujo completo pesaje → venta

#### Principios
- Nunca bloquea checkout si balanza no conecta (fallback a entrada manual)
- Validar rango de peso sensato (ej. 50g–50kg) antes de aceptar lectura
- Logs detallados para debugging en el campo
- Soportar múltiples balanzas por sucursal (una por tipo de producto: carne, verdura, etc.)

---

## Backlog / Fases futuras

Ideas validadas pero sin fecha definida.

- Pipelines de estado configurables por el cliente: el `StatusPipeline` actual tiene los pasos hardcodeados por tipo de documento. A futuro, permitir que cada organización defina sus propios estados y transiciones (ej. agregar "En revisión" entre Borrador y Confirmado), con la lógica de transición validada en backend.
- Multi-empresa (una instalación, múltiples razones sociales)
- Módulo de Recursos Humanos básico (empleados, liquidación de sueldos)
- Integración con medios de pago (Mercado Pago, transferencias bancarias)
- App móvil para vendedores (solo consulta y carga de pedidos)
- Portal de clientes (consulta de facturas y cuenta corriente)
- Integración con e-commerce (WooCommerce, Tiendanube)
- BI / Dashboards ejecutivos
- Descuentos comerciales avanzados:
  - Descuento global por documento (adicional al descuento por ítem)
  - Reglas/promociones (por cantidad, por categoría, combos)
  - Descuentos por cliente y por lista de precios con vigencia
  - Descuento por condición de pago (contado/anticipado)

---

## Principios que guían el roadmap

- Cada fase debe ser funcional y usable de forma independiente antes de empezar la siguiente.
- No se integra AFIP hasta que el flujo de ventas esté validado en uso real.
- La contabilidad es el último módulo porque necesita que todos los demás generen datos correctos.
- Se prioriza correctitud de datos financieros sobre velocidad de entrega.
