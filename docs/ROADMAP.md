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
- [x] Route groups: `(auth)/` para páginas públicas, `(erp)/` para páginas protegidas
- [x] ERP layout base con auth guard (`src/app/(erp)/layout.tsx`)
- [x] Modelo base de auditoría (`AuditModel`) con `created_by`, `updated_by`, `deleted_by` (FK a `users`), heredado por todos los modelos de negocio
- [x] Multi-tenant foundation: tablas `organizations` + `branches`, `org_id` en `AuditModel` y tablas de contactos, `branch_id` en `users`
- [x] Roles y permisos DB-backed: tablas `permissions` + `role_permissions`, defaults globales, override por organización, `sys-admin` bypass
- [x] `withPermission()` wrapper para route handlers (reemplaza boilerplate de auth manual en los 6 endpoints de contactos)
- [x] `src/lib/permissions.ts` con `can()`, `requirePermission()`, `ForbiddenError`, deduplicación con React `cache()`
- [x] Sesión extendida: `role`, `orgId`, `branchId` en JWT y session callbacks
- [x] Página de perfil de usuario (`/perfil`): nombre, email, rol, org, sucursal; avatar clickeable en Sidebar
- [ ] UX: componente global de error de API (banner/toast) + helper `fetchJson` para evitar duplicar manejo de errores en cada pantalla
- [ ] Dev tooling: comandos de seed/clear idempotentes creciendo con el sistema (incluye permisos, catálogo, ventas, tenancy)

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

### Primitivas base
- [x] Button (variantes: primary, secondary, ghost, danger; tamaños: sm, md, lg)
- [x] Input (estados: error, disabled, readonly)
- [x] FormField (label + control + mensaje de error, Radix Label)
- [ ] Select / Combobox (búsqueda, multi-select)
- [x] Textarea
- [ ] Checkbox y Switch
- [x] Badge / StatusBadge (para estados de documentos ERP)
- [ ] Tooltip
- [x] Modal / Dialog (con focus trap, Radix Dialog)
- [ ] Dropdown Menu

### Componentes de layout
- [x] TopBar / PageHeader (breadcrumb + slot de acciones)
- [ ] Card / Panel
- [x] Sidebar (navegación principal, logout, estado activo)
- [ ] Tabs

### Componentes ERP-específicos
- [x] DataTable (columnas configurables, sorting client-side, row actions)
- [x] TablePagination (anterior / siguiente y página actual, para tablas con datos paginados)
- [x] CurrencyInput (formato ARS: `$ 1.234,56`, edición en coma decimal, `Decimal.js`-safe)
- [x] DateInput (formato DD/MM/YYYY, automask, parse/format UTC)
- [x] SearchableSelect (estático y async con debounce 300ms, Radix Popover, sublabel)
- [x] TotalsFooter (subtotal / IVA desglosado por alícuota / total)
- [x] EmptyState (pantalla vacía con acción primaria e ícono configurable)
- [x] ConfirmDialog (danger/warning, loading state, Radix Dialog)
- [x] FormField (label + input + mensaje de error — envuelve cualquier control)

### Principios del design system
- Accesibilidad primero: todos los componentes deben ser navegables por teclado y compatibles con lectores de pantalla.
- Densidad de información alta: ERP, no landing page. Tablas compactas, formularios en columnas.
- Sin animaciones innecesarias. Transiciones solo donde ayudan a orientar al usuario.
- Cada componente tiene: story de estados, story de edge cases, y props documentadas en Storybook.

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
- [ ] Importación desde CSV

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
- [ ] Ajustes masivos de precios (por categoría / % / canal) y reglas
- [ ] Datos de logística / shipping por SKU (peso, dimensiones, bultos/presentaciones)

---

## Multitenancy & Tenancy Admin (en curso)

Trabajo transversal para garantizar aislamiento fuerte por `org_id` y `branch_id`, y un panel sys-admin para administrar organizaciones/sucursales/usuarios.

- [ ] Extender `organizations` con campos fiscales mínimos + Zod + UI sys-admin
- [ ] Extender `branches` con campos operativos (dirección estructurada, horarios, pos_number) + UI sys-admin
- [ ] Crear `organization_settings` (enabled_modules/features/customizations) + API sys-admin + lectura en layout/sidebar + guards por módulo/feature
- [ ] Reutilizar `BranchSelectField` en módulos branch-scoped y asegurar default + restricción por usuario en todos los formularios relevantes
- [ ] Suite de tests multitenant (no-cross-tenant) + permisos de sucursal (`user_branches`) para endpoints clave

### Pendientes derivados del plan multitenant org+branch

- [ ] Enforcements DB: completar checklist de tablas branch-scoped y asegurar índices/uniques *scoped* (`UNIQUE(org_id, ...)` / `UNIQUE(org_id, branch_id, ...)`) en todas las entidades relevantes
- [ ] Consistencia `org_id`↔`branch_id`: estandarizar estrategia (FK compuesta `(branch_id, org_id)` → `branches(id, org_id)` vs trigger) y aplicarla a todas las tablas branch-scoped
- [ ] Policy de lecturas: enforzar `user_branches` también en lecturas (no solo en writes) para todos los módulos branch-scoped
- [ ] Panel sys-admin: gestión de branches y usuarios con asignación de branches (`user_branches`) y branch default (`users.branch_id`)
- [ ] Wrapper tenancy: adopción gradual por módulo (ventas, catálogo, contactos, y futuros inventory/purchases/accounting) sin hacks y sin depender de `resolveOrgIdForMutation`
- [ ] Plan de validación/rollout: migraciones por pasos (nullable + backfill → NOT NULL → constraints) con tests “no cross tenant”
- [ ] Definir mapa base vs premium (ej. `accounting` premium; `inventory` premium por features) e integrarlo con `organization_settings`

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
- [ ] Notas de crédito internas
- [ ] Listado de cuentas corrientes por cliente
- [ ] Reportes: ventas por período, por cliente, por producto

---

## Fase 4 — Inventario

Gestión de stock integrada con ventas y compras.

**Entidades:** `warehouses`, `stock_items`, `stock_movements`

- [ ] Depósitos múltiples
- [ ] Stock actual por producto y depósito
- [ ] Movimientos de entrada y salida con trazabilidad
- [ ] Descuento automático de stock al facturar
- [ ] Reposición automática de stock al anular factura
- [ ] Alertas de stock mínimo
- [ ] Ajustes de inventario
- [ ] Remitos de entrega

---

## Fase 5 — Compras

Ciclo de compras: orden → recepción → factura proveedor → pago.

**Entidades:** `purchase_orders`, `purchase_receipts`, `supplier_invoices`, `supplier_payments`

- [ ] Órdenes de compra a proveedores
- [ ] Recepción parcial o total de mercadería
- [ ] Registro de facturas de proveedor (A, B, C)
- [ ] Conciliación orden → recepción → factura
- [ ] Registro de pagos a proveedores
- [ ] Cuentas corrientes de proveedores
- [ ] Reportes: compras por período, por proveedor

---

## Fase 6 — AFIP / Facturación Electrónica

Integración con AFIP para emisión de comprobantes electrónicos.
Se construye sobre el módulo de Ventas ya estable.

- [ ] Integración con AFIP vía WSFE (Web Service Facturación Electrónica)
- [ ] Autenticación con certificado digital (WSAA)
- [ ] Emisión de Facturas A, B, C electrónicas
- [ ] Notas de crédito y débito electrónicas
- [ ] Obtención y almacenamiento de CAE
- [ ] Reimpresión de comprobantes con CAE
- [ ] Manejo de contingencias (modo offline con posterior sincronización)
- [ ] Libro IVA Ventas digital
- [ ] Libro IVA Compras digital

---

## Fase 7 — Contabilidad

Módulo contable básico. Depende de todos los módulos anteriores.

**Entidades:** `accounts`, `journal_entries`, `journal_entry_lines`

- [ ] Plan de cuentas (adaptado a PyMEs argentinas)
- [ ] Asientos automáticos desde ventas, compras y pagos
- [ ] Asientos manuales
- [ ] Balance de sumas y saldos
- [ ] Estado de resultados
- [ ] Cierre de período
- [ ] Exportación para estudio contable

---

## Backlog / Fases futuras

Ideas validadas pero sin fecha definida.

- Multi-empresa (una instalación, múltiples razones sociales)
- Módulo de Recursos Humanos básico (empleados, liquidación de sueldos)
- Integración con medios de pago (Mercado Pago, transferencias bancarias)
- App móvil para vendedores (solo consulta y carga de pedidos)
- Portal de clientes (consulta de facturas y cuenta corriente)
- Integración con e-commerce (WooCommerce, Tiendanube)
- BI / Dashboards ejecutivos

---

## Principios que guían el roadmap

- Cada fase debe ser funcional y usable de forma independiente antes de empezar la siguiente.
- No se integra AFIP hasta que el flujo de ventas esté validado en uso real.
- La contabilidad es el último módulo porque necesita que todos los demás generen datos correctos.
- Se prioriza correctitud de datos financieros sobre velocidad de entrega.
