# Andiko ERP — Roadmap

ERP modular para PyMEs argentinas. Cada fase es desplegable de forma independiente.
El orden está definido por dependencias de datos y valor de negocio inmediato.

---

## Fase 0 — Fundaciones (en curso)

Infraestructura base sin lógica de negocio.

- [x] Scaffold Next.js 16 + TypeScript + Tailwind
- [x] pnpm, Vitest, ESLint, commitlint, husky, lint-staged
- [x] TypeScript 6.0 en todos los workspaces (preparación para TS 7 nativo — ver [docs/plans/typescript-6-upgrade.md](plans/typescript-6-upgrade.md))
- [ ] TypeScript 7 (tsgo): esperar soporte nativo en Next.js + API estable 7.1 (typescript-eslint); verificar binarios nativos vs `node:24-alpine`
- [x] release-it + conventional changelog
- [x] AGENTS.md + skills de Claude (ship-feature, release, setup-tooling)
- [x] Docker Compose con PostgreSQL 16 + pgAdmin (Colima como engine)
- [x] Makefile con comandos de entorno local (up, down, reset, shell, dev)
- [x] Despliegue producción VPS: Docker Swarm + nginx + Certbot — ver [docs/deployment/production.md](deployment/production.md)
- [x] **Ambientes de despliegue** (staging vs producción):
  - **Staging:** [Vercel](https://vercel.com) — rama `develop`, previews por PR, validación pre-release; sin datos reales de clientes
  - **Producción:** VPS **Hostinger** (Debian) en **https://andiko.cloud** — Docker Swarm, PostgreSQL persistente, releases vía imagen GHCR (`make prod-deploy`)
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
- [x] Versión deployada visible en ERP (sidebar, login, landing, menú mobile) vía `NEXT_PUBLIC_APP_VERSION`
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
- [x] Matriz de roles: filtros por módulo y rol, vista de permisos asignados/sin asignar, labels legibles, eliminar rol bloqueado con usuarios
- [x] Admin de organización unificado en `/organizaciones/[id]` (namespace API `settings` para Gerente)
- [x] Impersonación sys-admin: identidad efectiva en sesión, capabilities y perfil del usuario impersonado
- [x] Impersonación accesible en mobile: control en el menú mobile (`MenuPanel`) para sys-admin, incluso mientras impersona (iniciar/cambiar/detener sin sidebar de desktop)
- [x] UX: componente global de error de API (banner/toast) + helper `fetchJson` para evitar duplicar manejo de errores en cada pantalla
- [x] Dev tooling: comandos de seed/clear idempotentes creciendo con el sistema (incluye permisos, catálogo, ventas, tenancy)
- [x] Prod DB CLI: `db:reset-prod`, `migrate:prod`, `migrate:baseline-prod`, `db:seed-prod` (local, con `.env.production.local`)
- [x] Landing pública "Próximamente" en `/` con SEO (metadata, sitemap, robots, OG image, JSON-LD)
- [x] Panel ERP movido a `/panel`; redirects post-login y onboarding actualizados
- [x] Wizard de onboarding: persistencia de paso en servidor, reanudación (banner/sidebar), módulos desde `ORG_MODULE_DEFS`, AFIP compartido con Configuración, UX mobile
- [x] Capability `onboarding.manage` — solo Gerente y sys-admin pueden acceder al wizard y API de onboarding
- [x] Perfil y usuarios de org: `first_name` / `last_name` (migración + formularios de perfil y alta/edición)
- [x] API sys-admin de roles por organización (`/api/v1/sys-admin/organizations/[id]/roles`)
- [x] Formulario de contacto en landing vía Web3Forms (`ContactForm`, sin BD)
- [x] Landing de producto completa en `/` (desde diseño Claude Design): header sticky + nav con smooth-scroll, hero con mockup denso del panel ERP (`DashboardMockup`), secciones Módulos / Por qué / Métricas + rubros / Beta privada, footer. Lenguaje visual de marketing (botones 4px, tarjetas 12px, badges pill, foco teal) distinto del UI de producto.
- [ ] Mencionar el módulo POS en la landing (ausente en el diseño actual; pendiente decidir tarjeta/copy)
- [x] Documentación operativa GTM: packaging, programa beta, runbooks onboarding y soporte (`docs/gtm/`)
- [x] Documentación dev: getting-started, cross-module checklist, PR template (`.github/`)
- [x] README del proyecto, MULTITENANCY y production runbook alineados con estado v0.35+
- [x] Suite de tests de integración E2E (Cucumber + Playwright): tenant `integration`, seed dedicado, 27 escenarios activos — ver [Calidad — Tests E2E](#calidad--tests-de-integración-e2e)

---

## Calidad — Tests de integración (E2E)

Suite Gherkin en `tests/integration/` (Cucumber + Playwright). Complementa ~111 archivos Vitest de servicios; **no reemplaza** tests unitarios de lógica financiera/AFIP.

**Ejecución local:** `pnpm db:seed-dev` → `pnpm dev` → `HEADLESS=true pnpm test:integration --profile headed`  
**Tenant:** org `integration` (`test-admin@andiko.local` / `Test123456!`)  
**Estado (PR #64):** 27 escenarios pasando · 22 `@skip` (sin automatizar aún)

### Cubierto hoy (smoke operativo)

| Módulo | Escenarios | Qué valida |
|--------|------------|------------|
| Auth | 4 | Login, credenciales inválidas, logout, guard de rutas |
| Catálogo | 6 | CRUD producto, búsqueda, archivar, lista de precios |
| Contactos | 7 | CRUD, CUIT, CBU, filtros |
| Finanzas (CxC) | 5 | Deuda por cliente, abono, listado CxC, estado de cuenta, balance patrimonial (seed) |
| Compras | 3 | Ciclo OC → recepción → factura proveedor → pago; búsqueda y filtro por estado |
| Ventas | 2 | Búsqueda y filtro de facturas (listado) |

### Pendiente — prioridad beta (des-skipear)

Orden sugerido por impacto en negocio:

1. [ ] **Ventas — ciclo completo** (`@skip`): Presupuesto → factura → cobro + impacto en stock. *Gap más crítico vs. valor del ERP.*
2. [ ] **Inventario** (`@skip` en toda la feature): consulta de stock, deducción por venta, alertas, lotes, transferencias, conteo físico. *Sin steps implementados (`inventory.steps.ts`).*
3. [ ] **Ventas — cobros múltiples y NC por devolución** (`@skip`): operación diaria de cobranzas y devoluciones.
4. [ ] **Ventas — factura directa y presupuesto vencido** (`@skip`).
5. [ ] **Finanzas — reporte IVA** (`@skip`): requisito contador/AFIP en UI.
6. [ ] **Compras — recepción parcial, cancelación de OC, descuento por volumen** (`@skip`).
7. [ ] **Finanzas — deudas vencidas, diario contable, conciliación bancaria, retenciones** (`@skip`).

### Pendiente — infra y CI

- [ ] Job CI en `develop`: PostgreSQL + seed + dev server + `pnpm test:integration:ci`
- [ ] Aislar mutaciones entre escenarios (orden de ejecución / reset por feature)
- [ ] Perfil sin `parallel` en CI hasta tener fixtures independientes por escenario
- [ ] AFIP / emisión fiscal en E2E (hoy cubierto en unit: `src/modules/afip/*.test.ts`)
- [ ] POS, multitenancy cross-org, billing SaaS

### Excluido a propósito

- [ ] Sesión expirada tras 30 min (`@skip` en auth): impracticable en E2E; requiere mock de TTL o test de API.

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
- [x] Shell ERP desktop moderno: sidebar colapsable a icon-rail (estilo Datadog, preferencia en `localStorage`), menú de usuario en TopBar (arriba a la derecha) con email/rol/perfil/logout, placeholder de notificaciones; logout fuera del footer del sidebar
- [x] Tabs
- [x] Responsive móvil (<768px): barra de navegación inferior con Panel · Ventas · Productos · Menú (4 tabs, íconos más grandes); drawer "Menú" con el resto de módulos; Dialog con scroll y gutters; grillas de formulario/detalle que colapsan a una columna
- [x] Mobile UX — fase 2 (estilo WooCommerce iOS): `PageBody` (`min-h-0 overflow-auto`) elimina recorte de contenido por BottomNav en todos los 58 screens; `MenuPanel` pre-renderizado con transición CSS (instantáneo, sin navegación); `TopBar` en dos filas mobile (chevron ← + título 17px / acciones desplazables); `DataTable` role `actions` muestra botones en cards mobile; `onRowClick` en tablas de usuarios y sucursales abre modal de edición
- [x] PWA instalable: manifest + íconos de marca (192/512/maskable/apple-touch), `theme-color` y meta iOS web-app, display `standalone` (sin chrome del navegador); service worker estático que cachea solo assets inmutables de `/_next/static` (cache-first) y nunca HTML ni `/api/*` para no servir datos financieros desestabilizados; banner de instalación descartable (prompt Android + hint "Agregar a inicio" iOS); safe-area superior e inset de overscroll para modo standalone
- [x] PWA startup performance: ERP layout paralleliza `resolveCapabilities` + `getEffectiveOrganizationSettings` con `Promise.all` eliminando la cascada de DB calls secuenciales que causaba pantalla negra en iPhone; `PullToRefresh` reescrito eliminando tres bugs (transición CSS activa durante gesture, closure stale en touchend, scroll-lock en iOS); kebab menu en `DataTable` migrado a `DropdownMenuItem` (keyboard nav, auto-close, `role="menuitem"`); `GroupedMobileCard` soporta rol `actions`; pull-to-refresh cableado en Contactos y Catálogo vía `PageBody onRefresh`
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
- [x] AddressFields (dirección estructurada reutilizable: calle, número, piso, depto, ciudad, provincia, CP, país; controlada, con story; base para sucursales/contactos/ventas)

### Principios del design system
- Accesibilidad primero: todos los componentes deben ser navegables por teclado y compatibles con lectores de pantalla.
- Densidad de información alta: ERP, no landing page. Tablas compactas, formularios en columnas.
- Sin animaciones innecesarias. Transiciones solo donde ayudan a orientar al usuario.
- Cada componente tiene: story de estados, story de edge cases, y props documentadas en Storybook.

---

## Panel General (Dashboard)

Vista ejecutiva del negocio. Primer pantalla post-login.

- [x] KPI cards comerciales (PerformanceCard): Facturado c/ IVA, Cobrado, Pendiente (con sparklines y tendencia vs período anterior)
- [x] KPIs de decisión: Facturación neta, Margen bruto, Margen de ganancia (% sobre la venta), Rentabilidad, Punto de equilibrio, Por cobrar, Por pagar
- [ ] Dinero en cuentas — bloqueado hasta [Tesorería](#tesorería-impuestos-y-cumplimiento-ar-gaps-identificados--sin-fecha) (cuentas bancarias + conciliación); panel muestra CTA vacío, no calcula desde Caja/Banco del GL
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
- [x] KPI Cuentas por pagar + widget top 5 cobranzas/deudas (enlaza a reportes de aging)

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
- [x] Contacto de sistema por org “Consumidor Final” (`is_system` + `system_key`) — seed en alta de org, backfill, protegido de edición/borrado; preselección en nuevo pedido ERP

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
- [x] Etiquetas de góndola — pantalla de selección masiva por categoría, impresión browser-native (CSS @media print); listado paginado (100 variantes/pág) con DataTable
- [x] Ajustes masivos de precios (por categoría / % / canal) y reglas
- [x] Datos de logística / shipping por SKU (peso, dimensiones, bultos/presentaciones)
- [x] Importación CSV de productos con progreso en tiempo real (stream NDJSON)
- [x] Script de conversión WooCommerce → Andiko (`scripts/convert-wc-products-to-andiko.mjs`)
- [x] Listas de precios: detalle paginado, fill desde catálogo, clonar, hint lista predeterminada, sync import→lista default, toggle productos sin precio
- [x] Catálogo: eliminación masiva de productos; ajustes masivos con toggle sin precio base
- [x] Import catálogo → inventario: depósito fijo en confirmación; sync stock por `manage_stock`

---

## Multitenancy & Tenancy Admin (en curso)

Trabajo transversal para garantizar aislamiento fuerte por `org_id` y `branch_id`, y un panel sys-admin para administrar organizaciones/sucursales/usuarios.

### Panel sys-admin (completado)
- [x] `/sys-admin/organizaciones` — listado de orgs, crear/editar/eliminar
- [x] `/sys-admin/organizaciones/[id]` — detalle con sucursales y usuarios de la org
- [x] CRUD de sucursales por org (nombre, dirección, `branch_code`)
- [x] Dirección estructurada de sucursales (calle/número/piso/depto/ciudad/provincia/CP/país) vía componente `AddressFields`; columna `address` legacy derivada (string compuesto) para compatibilidad con lectores existentes
- [x] CRUD de usuarios por org: email, rol, contraseña, PIN POS, asignación de sucursales (`user_branches`), sucursal default
- [x] `requireSysAdmin` guard en todas las rutas sys-admin
- [x] `user_branches` ya operativo en `TenantContext` para filtrado por sucursal

### Pendientes
- [x] Campos fiscales de org en UI sys-admin (CUIT, razón social legal, condición IVA, domicilio fiscal)
- [x] `organization_settings` (enabled_modules/features) + guards por módulo/feature
- [x] Policy de lecturas: enforzar `user_branches` también en lecturas (no solo en writes)
- [x] Enforcements DB: índices/uniques scoped (`UNIQUE(org_id, ...)`) en entidades relevantes
- [x] Definir mapa base vs premium e integrarlo con `organization_settings`
- [x] Estandarización de contexto tenant en APIs: `resolveTenantContext` / `resolveOrgScope`, scoping en compras/ventas/catálogo, 422 coherente sin org

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
- [x] Permiso `sales:scope_own` (Solo propias): alcance por vendedor configurable en matriz; default en rol Vendedor
- [x] Tests unitarios: `calcLineItem`, `calcDocumentTotals`, `issueInvoice`, `cancelInvoice`, `createPayment` (48 assertions)

### Frontend
- [x] Presupuestos con vigencia y estado (listado + detalle + modal)
- [x] Expiración automática de presupuestos vencidos (cron) + filtro "Por vencer (7d)"
- [x] Conversión presupuesto → pedido → factura en un flujo (UI en detalle + navegación entre secciones)
- [x] Descuentos por ítem (modales de líneas; descuento a nivel documento según backend en totales)
- [x] Registro de cobros parciales y totales (UI en detalle de factura + listado de cobros)
- [x] Estados de factura: borrador, emitida, cobrada, anulada (UI listado + emitir / anular / cobros en detalle)
- [x] Rediseño UX Ventas — fase 1: `DatePicker` real con calendario (Radix Popover + react-day-picker)
- [x] Rediseño UX Ventas — fase 2: API `GET /api/v1/catalog/products/for-sale` con precio efectivo por lista
- [x] Rediseño UX Ventas — fase 3: `order_id` requerido en facturas (NOT NULL + Zod); conversión solo desde `delivered`; `price_list_id` en presupuestos, pedidos y facturas
- [x] Rediseño UX Ventas — fase 4: `SalesLineItemsEditor` (búsqueda de producto con autocomplete de precio/IVA) + `StatusPipeline` (stepper horizontal por tipo de documento)
- [x] Rediseño UX Ventas — fase 5: formularios de página completa para nuevo presupuesto y nuevo pedido; vistas de detalle rediseñadas con `StatusPipeline` + edición in-place + transiciones de estado; listas navegan a `/[id]` al hacer click; eliminación de InvoiceModal/OrderModal/QuoteModal
- [x] UX documentos Ventas — tipografía DS (labels 13px / inputs h-9), `FormSection`, `PaymentConditionSelector`, ítems numerados, errores toast+alert arriba, badges en tabs de estado (`DocumentStatusNav`)
- [x] Notas de crédito internas — NC-XX-NNNN, borrador → emitida → anulada; aplica automáticamente al saldo de factura vinculada; aparece en cuenta corriente del cliente
- [x] **Devoluciones y cambios de venta** — `sales_returns` (parcial/total, múltiples por pedido); stock IN/OUT; NC con ítems + AFIP; reembolsos (`sales_refunds`) o saldo a favor; estados de pedido `partial_returned` / `returned`; UI `/ventas/devoluciones`; flujo POS post-venta
- [x] Listado de cuentas corrientes por cliente
- [x] Reportes: ventas por período, por cliente, por producto
- [x] Reporte de cobranzas (aging CxC por cliente, buckets de vencimiento, export CSV)
- [x] **Impresión y exportación de documentos (MVP)** — Módulo `printing` (registro por dominio/recurso), API `GET /api/v1/printing/[domain]/[resource]/[id]`, vistas print bajo `/ventas/...` y `/compras/...` (layout A4, PDF vía `window.print()` + `@media print`). Borradores imprimibles con marca **BORRADOR** (uso interno).
- [x] Templates configurables por organización: logo, colores, datos fiscales (CUIT, IVA, domicilio), pie de página. *(Editor en `/configuracion`, link en sidebar, validación Zod + merge sobre defaults.)*
- [x] Editor visual de template (tipografía, paleta, secciones visibles). *(Vista previa en vivo del documento mientras se edita.)*
- [x] **Canal de venta WooCommerce** — módulo `integrations/woocommerce`: múltiples sitios por organización, cada uno vinculado a una sucursal y compartiendo su stock; pedidos ingresan como `SalesOrder` (`source='woocommerce'`, idempotente por `(sitio, woo_order_id)`, `needs_review` ante stock insuficiente); ingestión por webhooks (HMAC) + reconciliación por cron; catálogo bidireccional (publica productos/precios por lista, vincula por SKU); stock ERP→Woo vía outbox transaccional en cada movimiento + buffer de seguridad; onboarding de tiendas existentes (preview/apply con backfill de pedidos y baseline de stock). UI `/integraciones/woocommerce`. **Toca flujos de stock y ventas.**

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
- [x] Integración con ventas: descuento automático al confirmar pedido, restauración al cancelar pedido y al anular factura; devoluciones (`sales_return` / `sales_exchange`) con stock IN/OUT parcial
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
- [x] Transferencias de stock entre depósitos / sucursales
- [x] Carga masiva de stock desde catálogo por depósito (filtros, progreso NDJSON, cancelación)
- [x] Importación CSV de catálogo: depósito obligatorio en confirmación; stock según `manage_stock`
- [ ] Métodos de valuación de stock (FIFO / promedio ponderado) para costeo
- [ ] **Ubicaciones en depósito (WMS lite)** — zonas opcionales (picking, reserva, cuarentena) y posiciones con código (`A-12-03`); stock por variante × ubicación (además de depósito); transferencias internas entre ubicaciones; lista de picking para armado de pedidos; conteo cíclico por ubicación. *Priorizar clientes con depósito grande o varios operarios de picking.*
- [ ] Conteo físico / inventario cíclico — comparar stock teórico vs contado por depósito (y por ubicación cuando exista WMS), ajuste masivo auditado

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
- [x] UX paridad con Ventas — tabs de estado con conteos (`DocumentStatusNav` + `status-counts` en OC/recepciones/facturas/devoluciones), `FormSection`, condición de pago compartida, ítems numerados, errores toast+inline, totales con `calcTotals`

### Pendientes
- [x] Cuenta corriente proveedor — `/compras/cuenta-corriente` con historial de facturas + pagos, saldo, vencido y filtros por período (mismo patrón que ventas CC)
- [x] Listado agregado de CC proveedor (endpoint único, sin N+1)
- [x] Conciliación orden → recepción → factura (alertas de diferencias de precio/cantidad)
- [x] Reportes: compras por período, por proveedor, por categoría de producto
- [x] Reporte de deudas con proveedores (aging CxP, export CSV)
- [x] **Devoluciones y cambios de compra** — `purchase_returns` (devolución/cambio a proveedor, parcial/total); stock OUT para lo devuelto e IN para el cambio; reduce el saldo de la factura proveedor (neto del cambio); estados de orden `partial_returned` / `returned`; asiento contable automático; filas negativas en Libro IVA Compras; UI `/compras/devoluciones`

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
- [x] Páginas Libro IVA Ventas (`/contabilidad/libro-iva/ventas`) y Compras (`/contabilidad/libro-iva/compras`) con filtro por período; links legacy en Ventas/Compras redirigen
- [x] Pestaña de configuración AFIP: punto de venta por sucursal, carga de certificado ARCA (PEM) y cola de contingencia
- [x] Reimpresión de comprobantes con CAE + QR (RG 4291) en plantilla de impresión

---

## Facturación de Plataforma (SaaS Billing)

Módulo de facturación plataforma → organizaciones tenant. El ERP cobra a cada org por su suscripción (base + por-seat + add-ons de módulo + uso metered). Solo accesible desde el panel sys-admin (fase 1 — sin self-service de org ni gateway de pagos).

### Backend (completado)
- [x] Migraciones: `billing_plans`, `billing_plan_modules`, `billing_metrics`, `org_subscriptions`, `subscription_addons`, `billing_sequences`, `billing_invoices`, `billing_invoice_items`, `billing_payments`, `usage_records`
- [x] Modelos Sequelize con tipos estrictos para las 10 tablas del módulo
- [x] `billing.math.ts` — cálculo de cargos con `Decimal.js` (base + overage de seats + add-ons + uso metered + IVA 21%)
- [x] `billing.numbering.ts` — numeración global atómica (FAC-XXXXXX / PAG-XXXXXX) vía `billing_sequences` con `ON CONFLICT DO UPDATE`
- [x] Schemas Zod para todos los recursos (create / partial-update / query con paginación)
- [x] `billing-plans.service.ts` — CRUD del catálogo de planes
- [x] `subscriptions.service.ts` — asignación de plan a org, cambio de plan/seats/add-ons, transiciones de estado
- [x] `billing-invoices.service.ts` — `generateInvoiceForPeriod`, `issueBillingInvoice`, `voidBillingInvoice`, `recalcBillingInvoiceBalance` (atómico en transacción)
- [x] `billing-payments.service.ts` — registrar/eliminar pago con recálculo atómico de saldo (`SELECT FOR UPDATE` contra race conditions)
- [x] `usage.service.ts` — registro y agregación de uso metered por período
- [x] API REST bajo `/api/v1/sys-admin/billing/` — plans, subscriptions, invoices, payments, metrics, usage — todos con `requireSysAdmin()`
- [x] Tests unitarios: `billing.math.test.ts`, `billing-invoices.service.test.ts`, `billing-payments.service.test.ts`, `subscriptions.service.test.ts` (25 test cases)
- [x] `billing_plan_metric_allowances` + `subscription_metric_allowances` — franquicia incluida en plan y extras contratados por suscripción
- [x] Precio unitario de overage por métrica a nivel plan (`unit_price` en allowances del plan)
- [x] `billing-charges.service.ts` + `billing-preview.service.ts` — preview de período con desglose de seats, sucursales, add-ons y uso metered
- [x] `usage-meter.service.ts` — registro idempotente de uso (AFIP: `afip_invoices_issued` al aprobar CAE)
- [x] `billing-metrics.catalog.ts` + sync de catálogo; límites de sucursales y extras (`billing_plan_extras`)
- [x] Facturas de plataforma con snapshot de conteos facturados; impresión PDF/HTML de factura sys-admin
- [x] Portal org `/facturacion` — vista de suscripción, facturas y advertencias de capacidad

### Frontend (completado)
- [x] `/sys-admin/billing` — dashboard con `StatCard`s (total/activas/vencidas), tabla de suscripciones, navegación a planes
- [x] `/sys-admin/billing/planes` — catálogo de planes con CRUD modal; grid de add-ons mobile-safe
- [x] `/sys-admin/billing/suscripciones/[id]` — detalle: info card semántico `<dl>/<dt>/<dd>`, listado de facturas con acciones contextuales, modal generar factura, modal registrar pago, confirmación de anulación
- [x] `StatCard` — primitiva reutilizable en `src/components/erp/StatCard.tsx` (label, value, tone)
- [x] `SubscriptionModal` — patrón de formulario interno (remount en cada apertura, sin estado residual)
- [x] Mobile UX: `mobileRender` en todas las columnas `_actions`, skeletons de carga, DataTable con roles mobile
- [x] Entrada "Facturación" en sidebar sys-admin (desktop y mobile)
- [x] Dashboard de facturación para Gerente (`/facturacion`, rotulado "Suscripción" para no confundir con facturas de venta): suscripción vigente, consumo del período y facturas + detalle de factura (solo lectura). Capability `nav.facturacion`; API org-scoped `/api/v1/billing/*` con guard `requireOrgBilling` (resuelve la org propia, exige `settings:read`, nunca confía un `org_id` del cliente)
- [x] Datos del emisor de plataforma (razón social, CUIT, condición IVA, domicilio, IIBB, inicio de actividades, email, teléfono) en `platform_settings`; pantalla sys-admin `/sys-admin/billing/emisor`
- [x] Snapshot del emisor en la factura al emitir (draft→issued), inmutable; bloque "Emisor" en el detalle de factura del Gerente
- [x] `/sys-admin/billing/metricas` — catálogo de métricas (sin pricing global; precio en plan)
- [x] `/sys-admin/billing/facturas/[id]` — detalle, pagos, impresión; `RecordPaymentModal` compartido
- [x] `PlanModal` — consumo medido (cantidad incluida + precio extra por métrica)
- [x] `SubscriptionModal` + `SubscriptionUsageSection` — allowances de métricas y registro manual de uso
- [x] `BillingSubNav`, badges de estado de facturación, preview de período con copy de capacidad (contrato vs incluidos)
- [x] Impersonación sys-admin: nombre de org en búsqueda/recientes; panel org con nombre en título
- [x] **Monetización por sitio (WooCommerce)** — `included_sites` / `per_site_price` en planes, conteo de sitios activos, línea de cargo `site` (espejo de sucursales), snapshot `billed_sites` en factura, campos en `PlanModal` y seed
- [x] **Servicio de archivos** — backends S3, Google Drive y Dropbox; credenciales en `platform_settings`; ReBAC por registro vinculado + shares explícitos; adjuntos en compras (facturas proveedor, recepciones); preview PDF/imagen; sys-admin `/sys-admin/storage`
- [x] Test de almacenamiento desde `/sys-admin/storage` — `POST/DELETE /api/v1/sys-admin/storage-settings/test` (S3: presigned PUT, descarga presignada, stream preview; HeadObject; eliminación manual)
- [x] `/documentos/compartidos` — listado de archivos compartidos explícitamente con el usuario (sin permiso de módulo sobre el registro vinculado)
- [x] Medición de storage en tiempo real al subir/eliminar archivos (`storage_gb` / `storage_files` en `usage_records`; job diario de reconciliación)
- [x] Paths estructurados de almacenamiento (`{slug}/suc-{code}/{módulo}/{entidad}/{yyyy}/{mm}/{dd}/…`); slug de org inmutable tras creación

### Pendientes (fases futuras)
- [ ] Gateway de pagos (Mercado Pago / Stripe) + webhooks para débito automático
- [ ] Portal self-service de facturación para la org — autogestión (cambiar plan/seats, pagar). El panel de lectura para el Gerente (suscripción, consumo, facturas) ya está implementado
- [ ] Factura electrónica AFIP (CAE) de la plataforma hacia las orgs *(datos del emisor + snapshot en la factura ya implementados como base)*
- [x] Generación automática de facturas recurrentes (cron) — UI sys-admin en `/sys-admin/billing/automatizacion`; job `POST /api/v1/sys-admin/billing/jobs/generate-due-invoices` (`CRON_SECRET`); genera drafts + avanza `current_period_*`
- [x] Dunning parcial — `billing-dunning.service.ts` marca `past_due` al vencer facturas impagas; job `POST /api/v1/sys-admin/billing/jobs/dunning`; reactivación al registrar pago
- [x] Suspensión / bloqueo de acceso ERP en `past_due` — redirect a `/suspendido` (exentos `/facturacion` y sys-admin), API bloquea mutaciones con 403 `SUBSCRIPTION_SUSPENDED`, reactivación al registrar pago

---

## Fase 7 — Contabilidad

Módulo contable básico. Depende de todos los módulos anteriores.

**Entidades:** `accounts`, `journal_entries`, `journal_entry_lines`

- [x] Plan de cuentas (adaptado a PyMEs argentinas) — sembrado por defecto, editable
- [x] Asientos automáticos desde ventas, compras y pagos — `sales_invoice`, `sales_payment`, `purchase_invoice`, `purchase_payment`, `expense_invoice`, `expense_payment` (idempotentes por `source_type`+`source_id`, no-fatales ante cuentas faltantes)
- [x] Asiento automático al completar devolución de venta (`sales_return` → NC / reembolso)
- [x] Asiento automático al completar devolución de compra (`purchase_return` → reverso Mercaderías / IVA crédito / Proveedores, + cambio)
- [x] Asientos manuales — partida doble, débito/haber balanceado, estados borrador/contabilizado
- [x] Balance de sumas y saldos — con filtro por sucursal (centro de costo)
- [x] Estado de resultados (`/contabilidad/estado-de-resultados`) — ingresos / CMV / gastos por prefijo de código, excluye asientos de cierre, export CSV
- [x] Cierre de período (`/contabilidad/cierres`) — tabla `accounting_periods`, asiento de cierre contra `3.2.02`, reapertura por asiento de reversión (nunca borra); bloquea contabilizar asientos manuales en período cerrado; auto-posting reimputa comprobantes tardíos al primer día abierto
- [x] Exportación para estudio contable (`/contabilidad/exportacion`) — libro diario y sumas y saldos en CSV (BOM UTF-8, límite 50k filas)

> Dimensión de sucursal (centro de costo) opcional a nivel de línea de asiento: los libros se mantienen a nivel empresa (CUIT).

### Finanzas vs Contabilidad (alcance en Andiko)

| | **Finanzas / Tesorería** | **Contabilidad** |
|---|---|---|
| **Pregunta que responde** | ¿Quién me debe, a quién debo, cuándo cobro/pago, con qué medio? | ¿Cómo queda registrado en los libros (debe/haber, cuentas, períodos)? |
| **Enfoque** | Operativo del día a día — flujo de caja y gestión de cobranzas/pagos | Normativo y de cierre — plan de cuentas, asientos, balances, exportación al estudio |
| **Dónde está hoy** | Cuenta corriente clientes en **Ventas** (`/ventas/cuenta-corriente`), proveedores en **Compras** y **Expensas**; pagos y saldos en documentos; gaps en sección [Tesorería](#tesorería-impuestos-y-cumplimiento-ar-gaps-identificados--sin-fecha) (cheques, banco, cobranzas) | Módulo **Contabilidad** (`/contabilidad`): plan de cuentas, asientos manuales, auto-posting completo (ventas, compras, pagos, expensas y devoluciones), balance, estado de resultados, cierres de período y exportación; Libro IVA en UI contable |
| **Usuario típico** | Administración, cobranzas, tesorería | Contador / responsable de cierre |
| **Relación** | Un cobro en finanzas debería generar (o vincularse a) un asiento contable cuando el auto-posting esté completo | Los asientos reflejan hechos ya ocurridos en ventas, compras, tesorería e inventario |

No hay módulo separado llamado "Finanzas": la operación financiera vive repartida entre Ventas, Compras y (a futuro) Tesorería; Contabilidad consolida el impacto en cuentas.

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
- [x] Preset **Servidor Andiko** en `/sys-admin/email` (mailserver:587, erp@andiko.cloud) para SMTP self-hosted
- [x] Toggle mostrar/ocultar (`PasswordInput`) en campos de contraseña SMTP y de usuario/PIN POS (`OrgUserModal`)
- [x] Templates de email por tipo de documento (presupuesto, pedido, factura, remito) — editor UI por org en `/configuracion` (tab "Plantillas de email") + defaults con variables `{{contact_name}}`, `{{document_number}}`, `{{total}}`, etc.
- [x] Envío de documentos al cliente desde el detalle (componente `SendDocumentEmail`: botón "Enviar por email" en presupuestos, pedidos, facturas y remitos) + servicio de envío que persiste `email_logs`
- [x] Precarga del email del contacto en el diálogo de envío (`contact.email` en APIs de ventas/inventario)
- [x] **Hub de notificaciones (v1):** tablas `notifications` + `notification_deliveries`; `emitNotification()` con channel adapters; email de documentos ruteado por evento `sales.document.shared` (mantiene compatibilidad con `email_logs` vía `notification_delivery_id`)
- [x] Historial de envíos por documento — listado en el diálogo de envío
- [x] Bandeja de auditoría **Emails enviados** por organización — tab en `/configuracion` con listado paginado, filtros y detalle del contenido renderizado guardado
- [x] Persistencia de contenido en `email_logs` (`body_text`, `body_html`, `transport`, `message_id`) para envíos nuevos

### Infraestructura mail (completado)
- [x] Servidor `@andiko.cloud` containerizado en Docker Swarm (`docker-mailserver`) — guía [docs/deployment/mail-server.md](deployment/mail-server.md)
- [x] Scripts: `prod-init-mail`, `prod-mail-add-user`, `prod-mail-dkim`, `prod-mail-check`, `prod-backup-mail`
- [x] Preset **Servidor Andiko** en `/sys-admin/email` (SMTP interno `mailserver:587` + SNI TLS para cert `mail.andiko.cloud`)
- [x] Runbook incidente 502 / `db: disconnected` — `prod-sync-db-password` y rotación de secrets sin `stack rm`

### Pendiente (Comunicaciones / notificaciones)
- [ ] API `/api/v1/notifications` (listar in-app, marcar leídas) y centro de notificaciones (campana en header)
- [ ] `notification_preferences` por org/usuario/evento/canal
- [ ] Eventos automáticos post-mutación (ej. pedido confirmado → in-app + email opcional)
- [ ] Canal **push** (FCM / Web Push)
- [ ] Migrar bandeja "Emails enviados" a vista unificada por canal (`notification_deliveries` donde `channel = email`)
- [ ] Templates por `(event_key, channel)` en lugar de solo `documentType` en `email_templates`
- [ ] Ver **Fase 10 — Colaboración interna** (comentarios en documentos, chat de equipo, alertas proactivas). Las alertas proactivas (stock mínimo, presupuestos por vencer) viven ahí, no en email.

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
- [x] `GET /api/v1/pos/customers` — clientes con delta por `since` (incluye `is_system` / `system_key`)
- [x] `GET /api/v1/pos/users` — cajeros autorizados con `pos_pin_hash` (delta por `since`)
- [x] `POST /api/v1/pos/sales/sync` — batch de ventas offline → `sales_orders` con trazabilidad POS
- [x] Consumidor Final de sistema preseleccionado en venta POS; sync persiste `contact_id` (fallback fiscal sintético si el dispositivo aún no sincronizó el contacto)

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
- [x] Medios de pago dinámicos — `pos_payment_methods` + `pos_branch_payment_methods`; configurables desde ERP por org/sucursal, sincronizados al POS; `payments[]` en backend (múltiples filas por venta); **checkout POS hoy envía un solo medio** — UI mixta pendiente
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

## Fase 9 — Producción

Fabricación / ensamble para PyMEs que transforman insumos en productos terminados (alimentos, cosmética, muebles, repuestos ensamblados, etc.).

**Depende de:** Inventario (movimientos, lotes, depósitos), Catálogo (variantes y tipos de producto). **Se integra con:** Compras (insumos), Ventas (producto terminado), Contabilidad (costeo y asientos al cerrar OP — posterior).

**Entidades previstas:** `bills_of_materials`, `bom_items`, `production_orders`, `production_order_lines` (consumos planificados/reales)

### MVP
- [ ] Tipos de producto en catálogo: insumo, semielaborado, producto terminado (fabricado)
- [ ] Lista de materiales (BOM) por producto terminado: componentes, cantidades por unidad, merma opcional
- [ ] Orden de producción: estados borrador → liberada → en proceso → terminada / cancelada
- [ ] Al liberar/iniciar: reserva o consumo de insumos vía `stock_movements` (OUT), con lotes FEFO cuando aplique
- [ ] Al cerrar: ingreso de producto terminado vía `stock_movements` (IN); cantidad real producida vs planificada
- [ ] UI `/produccion`: listado de órdenes, detalle, alta/edición de BOM por variante
- [ ] Permisos y scope `production` (commitlint) al implementar

### Posterior
- [ ] Producción parcial y backflush
- [ ] Costo estándar vs real por orden (requiere valuación FIFO/PMP de Fase 4)
- [ ] Asiento contable automático al cerrar orden de producción (Fase 7)
- [ ] Subcontratación / tercerización de etapas
- [ ] Planificación ligera (MRP): explosión de BOM según pedidos de venta pendientes

> **No confundir con Logística** (`/logistica`, envíos al cliente): producción es transformación interna en planta; logística es salida física hacia el comprador.

---

## Fase 10 — Colaboración interna

Notificaciones, comentarios en documentos y chat entre usuarios de la misma organización. Complementa **Comunicaciones / Email** (salida al cliente) con colaboración **dentro** del ERP.

**Depende de:** Auth, permisos por módulo, detalle de documentos en ventas/compras/logística. **Scope commitlint:** `communications`.

**Entidades previstas:** `notifications` (parcial — v1 con deliveries), `entity_comments` (polimórfico), `conversations`, `conversation_messages`, `notification_preferences`

### Hub de notificaciones (parcial — v1)
- [x] Tablas `notifications` + `notification_deliveries` con channels (`email`, `in_app`, `push` stub)
- [x] `emitNotification()` + adapters de canal; email de documentos vía evento `sales.document.shared`
- [x] Tests: `document-notification.service.test.ts`, delegación en `send-document.service.test.ts`
- [ ] API REST in-app + centro de notificaciones en header
- [ ] Worker/outbox para entregas async en eventos automáticos

### Comentarios y observaciones en documentos
- [ ] Hilo de comentarios en detalle de entidades operativas: presupuestos, pedidos, facturas, notas de crédito, órdenes de compra, recepciones, facturas de proveedor, devoluciones (venta/compra), remitos, envíos (logística)
- [ ] Texto libre + `@mención` a usuarios de la org → dispara notificación
- [ ] Visibilidad acotada por `org_id`; lectura/escritura según permiso del documento padre
- [ ] Auditoría: `created_by`, timestamps; edición limitada o solo soft-delete
- [ ] UI: timeline / panel "Actividad" en pantallas de detalle (junto a adjuntos e historial de estados)

### Notificaciones in-app
- [x] Modelo `notifications` (`event_key`, `payload` JSONB, `read_at`, `org_id`, destinatario polimórfico)
- [ ] Centro de notificaciones (campana en header ERP) + marcar una/todas como leídas
- [ ] Eventos iniciales: mención en comentario, cambio de estado relevante, asignación (cuando exista), stock bajo umbral, presupuesto por vencer
- [ ] Preferencias por usuario (opt-in/out por tipo de evento)
- [ ] Digest por email opcional (reutiliza SMTP de Comunicaciones)

### Chat interno
- [ ] Conversaciones 1:1 entre usuarios de la org
- [ ] Canales por equipo o sucursal (ej. `#ventas`, `#depósito`) — opcional en MVP si 1:1 basta
- [ ] Mensajes con polling o SSE en v1; WebSocket si hace falta escala
- [ ] Adjuntar enlace a documento del ERP (`/ventas/pedidos/:id`, etc.) con preview mínimo
- [ ] **Comentario en documento ≠ chat:** comentario queda atado al registro y en auditoría; chat es conversación libre

### Infra y jobs
- [ ] Emisión de eventos desde services (cambio de estado, comentario creado) — bus ligero o hooks en capa de servicio
- [ ] Worker/cron para alertas proactivas (stock mínimo, vencimientos) — mismo scheduler que otras tareas diferidas
- [ ] Límites de retención y paginación en listados (sin queries sin `LIMIT`)

---

## Fase 11 — Asistente IA

Consultas en lenguaje natural sobre datos del ERP y, más adelante, acciones asistidas. Inspiración competitiva (ej. devy-AI) pero con **integridad de datos** y permisos Andiko como prioridad.

**Depende de:** APIs/servicios estables de ventas, inventario, compras y CxC. **Recomendado después de** Fase 10 para reutilizar notificaciones. **Stack previsto:** Vercel AI SDK + AI Gateway; modelo configurable a nivel plataforma (sys-admin), intercambiable sin cambiar tools.

### MVP — solo lectura
- [ ] Panel o ruta `/asistente` (chat in-app)
- [ ] Tools que llaman **services** existentes (nunca SQL ni ORM desde el LLM): ventas del período, stock por depósito, aging CxC, pedidos pendientes, top clientes
- [ ] Contexto estricto: `org_id` + permisos efectivos del usuario en sesión (mismo `withPermission` / `can()`)
- [ ] Respuestas en español rioplatense; citar fuente (ej. "según facturas de marzo")
- [ ] Log de consultas para soporte/auditoría (sin volcar PII innecesaria)

### Posterior
- [ ] Sugerencias proactivas (complementa notificaciones Fase 10)
- [ ] Acciones con confirmación humana en UI ("crear presupuesto borrador para…") — siempre vía services + transacción
- [ ] Resumen diario/semanal por email
- [ ] Canal WhatsApp Business API (opcional; mismo backend de tools)

### Principios
- El LLM **no escribe** en base de datos en MVP
- Acciones que mutan estado requieren confirmación explícita y respetan el mismo flujo que la UI manual
- No sustituye reportes contables ni libros AFIP — deriva a módulos formales cuando corresponda

---

## Fase 12 — Automatizaciones

Scheduler de tareas recurrentes tipo cron, pensado como base extensible para automatizaciones futuras (diferencial de producto). Org-scoped con `branch_id` opcional — ver [docs/MULTITENANCY.md](MULTITENANCY.md). Módulo premium (`ORG_MODULE_DEFS`).

- [x] Tablas `scheduled_tasks` / `scheduled_task_runs` (historial de ejecución)
- [x] Registro de acciones plugeable (`action-registry.ts`) — sumar un tipo de acción nuevo no requiere tocar el core del scheduler
- [x] Runner con claim por concurrencia optimista (`scheduled-task-runner.service.ts`), seguro ante ticks solapados o réplicas de la app; auto-pausa tras fallos consecutivos
- [x] Tick vía `CRON_SECRET` (`/api/v1/sys-admin/jobs/automations-tick`, crontab cada minuto — ver [docs/deployment/production.md](deployment/production.md))
- [x] CRUD tenant + UI `/automatizaciones` (lista, crear/editar, ejecutar ahora, historial de ejecuciones)
- [x] Acciones v1: `sales.expire_overdue_quotes`, `core.webhook_call` (webhook saliente genérico)
- [x] `expenses.generate_recurring_expense` — genera automáticamente las facturas de Expensas vencidas (ver Fase 14)
- [x] UI de cron amigable (presets) + payloads tipados por acción en `/automatizaciones`
- [ ] Más acciones por módulo (recordatorios de cobranza, sincronizaciones, notificaciones; futuros servicios recurrentes que la org vende a sus clientes)
- [ ] Automatizaciones cross-org
- [ ] Workflows multi-paso / condicionales (hoy: una acción por tarea)
- [ ] Cadencias menores a 1 minuto (hoy: piso del tick por crontab externo)

---

## Fase 13 — Control de Horario (RRHH)

Control de horario / fichaje como base para una futura liquidación de sueldos. Se construye por fases: la Fase 1 es un control de horario útil por sí solo (fichaje propio, carga manual, import desde reloj físico); la liquidación de sueldos queda para una fase posterior una vez que haya suficiente historial de horas trabajadas.

**Depende de:** `users`/`branches` (Auth). **Se integra con (posterior):** Contabilidad (asientos de sueldos/cargas sociales al liquidar).

**Entidades:** `employees` (legajo, vinculado opcionalmente 1:1 a `users`), `attendance_events` (fichadas discretas: entrada/salida/ausencia, con `source` self_service | manual | device_import)

### Fase 1 — MVP (completado)
- [x] Legajo de empleado (`Employee`) independiente de `User`, para poder registrar personal sin acceso al sistema
- [x] Fichaje self-service (entrada/salida) desde `/control-horario`
- [x] Carga y corrección manual por admin/RRHH (sesión, evento único, ausencia) desde `/control-horario/registros`
- [x] Importación CSV de fichadas desde relojes físicos (biométricos/fichadores), con dedup contra reimportaciones del mismo archivo
- [x] Totales de horas trabajadas por día, calculados al leer (pareo cronológico de eventos, sin guardar floats)
- [x] Permisos `employees:*` / `attendance:*` + `attendance:scope_own`, módulo `hr` (tier premium — habilitado salvo que el admin lo restrinja explícitamente en Configuración, igual que inventory/purchases/accounting/pos)

### Posterior
- [ ] Horarios pactados (`work_schedules`) para detectar llegadas tarde / horas extra
- [ ] Ausencias/licencias/vacaciones como entidad propia con aprobación (`leave_requests`)
- [ ] Flujo de aprobación de correcciones (`attendance_events.corrects_event_id` ya está en el esquema)
- [ ] Liquidación de sueldos: tarifas/sueldo (`NUMERIC(15,2)` + Decimal.js), cálculo de períodos, asientos contables (Fase 7)
- [ ] Import CSV multi-marca de reloj (adaptadores por dispositivo), columnas Fecha+Hora separadas, polling automático

### Limitaciones conocidas (Fase 1)
- Turnos que cruzan medianoche (ej. 23:00 a 07:00 del día siguiente) no se calculan correctamente en `computeDailyTotals` — cada fichada se agrupa por su propio `work_date`, sin pareo entre días. Ver comentario en `src/modules/attendance/attendance.utils.ts`.
- El import CSV es todo-o-nada: si una fila del archivo falla, se revierte la transacción completa (mismo comportamiento que el import de contactos). Para archivos grandes de reloj físico, una sola fila corrupta obliga a reimportar todo.

---

## Fase 14 — Expensas

Gastos fijos/recurrentes de la empresa (alquiler, luz, agua, seguros, planes en cuotas, etc.) — módulo independiente de Compras: comparte únicamente la entidad `Contact` (proveedor), no `supplier_invoices`. Módulo premium (`ORG_MODULE_DEFS`), permiso `expenses:*`.

**Modelo unificado:** un solo listado `/expensas` y un flujo *Nuevo gasto* con 3 tipos — `one_off` (único), `recurring` (serie indefinida + ocurrencias), `installment_plan` (1 gasto = total del plan + calendario de cuotas).

**Entidades:** `expenses` (con `kind`), `expense_items`, `expense_payments`, `expense_schedules` (ex `recurring_expense_templates`), `expense_schedule_items`, `expense_installments`, `credit_cards`, `credit_card_statements`

- [x] Migraciones: schedules, expenses, expense_payments, expense_installments + permisos `expenses:read/write/delete`
- [x] Flujo de estados igual que Compras: `draft → received → partially_paid/paid`, con `cancelled` en cualquier punto no pagado
- [x] Flujo de pagos propio (`expense_payments`) con actualización atómica de `paid_amount`/`balance`/`status`; en planes, pago ligado a cuotas (`installment_ids`)
- [x] Contabilización automática: `expense-accounting.service.ts` (débito cuenta de gasto elegida + IVA crédito fiscal, crédito Proveedores) y `expense-payment-accounting.service.ts` (cancelación de deuda) — el plan contable se asienta por el **total** al recibir
- [x] Gasto recurrente: `expense_schedules` + acción `expenses.generate_recurring_expense` (genera ocurrencias en borrador y avanza `next_run_date`); al crear tipo Recurrente se emite también el 1er período
- [x] Plan / cuotas: un gasto `installment_plan` + N filas en `expense_installments` (vencimiento, monto, estado); cronograma manual con montos/fechas distintos y cuotas ya pagadas (prepaid sin payment row)
- [x] Tarjetas de crédito: ficha con días de cierre/vto + resúmenes mensuales ARS/USD (FX al cargar) que generan un gasto confirmado (`/expensas/tarjetas`)
- [x] Las facturas de Expensas se incluyen en **Libro IVA Compras** (`buildLibroIvaCompras`) para no perder crédito fiscal, aunque el módulo esté separado de Compras
- [x] Adjuntos opcionales: factura del proveedor (`owner_type: 'expense'`) y comprobante de pago (`owner_type: 'expense_payment'`)
- [x] UI unificada `/expensas` (lista + tipos + detalle con cuotas/serie); sin tabs Facturas/Recurrentes/Pagos
- [x] Reportes `/expensas/reportes` — KPIs del período, torta por tipo y por proveedor, barras mensuales
- [x] Panel: KPI Expensas + widget por tipo + por pagar/gastos del período cuando el módulo está habilitado
- [x] Alta rápida de proveedor desde Nuevo gasto (`SupplierQuickCreateDialog`)
- [x] Líneas de detalle por gasto (cantidad, precio, descuento, IVA y cuenta contable); las series recurrentes copian snapshots para preservar el histórico
- [x] Frecuencia bimestral en series recurrentes; carga Con IVA / Sin IVA (default Con IVA); actualizar monto futuro de la serie sin reescribir ocurrencias
- [x] Copy de estados: Confirmar gasto / Confirmado; Anular / Anulado
- [x] Cuenta corriente / aging por proveedor de Expensas — `/expensas/cuenta-corriente` + sección aging en `/expensas/reportes` (solo gastos con proveedor asignado)
- [ ] Conciliación bancaria de pagos de Expensas
- [x] Sincronizar estado/saldo del resumen de tarjeta con el gasto vinculado (pago, pago parcial, anulación); período reutilizable si el resumen se anula
- [x] Corrección de gastos confirmados: revertir a borrador (reversión de asiento + repost al reconfirmar); montos de cuotas pendientes editables; montos de resúmenes de tarjeta editables
- [x] Listado `/expensas` con tabs Activos vs Borradores/anulados; sección Notas u observaciones en detalle de todo gasto
- [x] Listado: totales de Total/Saldo del filtro actual + días hasta vencimiento / días atrasados en la columna de vencimiento


---

## Tesorería, Impuestos y Cumplimiento AR (gaps identificados — sin fecha)

Funcionalidades fiscales y de tesorería específicas de Argentina que hoy están
ausentes del producto y que el resto del roadmap no cubre. Críticas para
adopción B2B en PyMEs argentinas; relevadas en revisión de producto.

### Impuestos / AFIP
- [ ] Retenciones y percepciones (IVA, Ganancias, IIBB; SICORE, Convenio Multilateral, ARCIBA) — cálculo, certificados y reportes
- [ ] Padrón AFIP / constancia de inscripción: autocompletar datos fiscales del contacto desde el CUIT
- [ ] Factura de Crédito Electrónica MiPyME (FCE)
- [ ] Remito electrónico AFIP

### Tesorería / Finanzas
- [ ] Gestión de cheques (terceros y propios, e-cheq): cartera, estados, vencimientos, aplicación a cuenta corriente
- [ ] Conciliación bancaria + múltiples cuentas bancarias — desbloquea el KPI **Dinero en cuentas** del [Panel General](#panel-general-dashboard)
- [ ] Multi-moneda (operaciones en USD) + ajuste por inflación / revaluación
- [ ] Workflow de cobranzas (recordatorios de pago, gestión de mora) sobre cuenta corriente

> Ver también [Finanzas vs Contabilidad](#finanzas-vs-contabilidad-alcance-en-andiko) en Fase 7. Hoy la cuenta corriente ya opera en Ventas/Compras; esta sección cubre lo que falta para tesorería completa (banco, cheques, cobranzas proactivas).

---

## Backlog / Fases futuras

Ideas validadas pero sin fecha definida.

- **Activos fijos / Bienes de uso** — compra de maquinaria, herramientas durables, equipos (no mercadería). Hoy Compras está pensado para productos a revender (stock) y Expensas para egresos operativos que impactan el resultado; no hay módulo para capitalizar en `1.2.01` (Bienes de uso) + amortización (`5.2.08`). Un plan/cuotas en Expensas controla el pago, pero asienta el total como gasto al confirmar — incorrecto para activos. Alcance futuro: ficha del bien, alta/baja, vida útil, asientos de compra a activo (con o sin cuotas) y amortizaciones; hogar natural junto a Contabilidad, no dentro de Compras.
- Pipelines de estado configurables por el cliente: el `StatusPipeline` actual tiene los pasos hardcodeados por tipo de documento. A futuro, permitir que cada organización defina sus propios estados y transiciones (ej. agregar "En revisión" entre Borrador y Confirmado), con la lógica de transición validada en backend.
- Multi-empresa (una instalación, múltiples razones sociales)
- Liquidación de sueldos (ver [Fase 13 — Control de Horario (RRHH)](#fase-13--control-de-horario-rrhh), Fase 1 de control de horario ya implementada)
- Integración con medios de pago (Mercado Pago, transferencias bancarias)
- App móvil para vendedores (solo consulta y carga de pedidos)
- Portal de clientes (consulta de facturas y cuenta corriente)
- Integración con e-commerce (WooCommerce, Tiendanube)
- BI / Dashboards ejecutivos *(parcialmente cubierto por Fase 11 Asistente en consultas ad-hoc)*
- CRM básico (leads, oportunidades, pipeline comercial)
- [x] Adjuntos de documentos (comprobantes / PDFs) en compras — facturas de proveedor y recepciones
- [ ] Extender adjuntos a ventas, contactos y catálogo
- Bitácora de auditoría visible para el usuario (historial de cambios; hoy solo campos `created_by/updated_by`) *(comentarios en Fase 10 cubren parte del caso "quién dijo qué")*
- Límite de crédito por cliente (bloqueo/alerta al superar saldo en cuenta corriente)
- Comisiones de vendedores
- Descuentos comerciales avanzados:
  - Descuento global por documento (adicional al descuento por ítem)
  - Reglas/promociones (por cantidad, por categoría, combos)
  - Descuentos por cliente y por lista de precios con vigencia
  - Descuento por condición de pago (contado/anticipado)

**Infra VPS (observabilidad y disco):**

- [ ] Logrotate para `/var/log/andiko-*.log` (crons backup/certbot)
- [x] `make prod-prune` — limpieza segura Docker (build cache, contenedores stopped, imágenes Andiko viejas)
- [x] `make prod-disk-check` — diagnóstico de disco
- [ ] `daemon.json.example` — defaults globales de logging Docker

**Logging de plataforma:**

- [x] PostHog: analytics, error tracking, server logs (OTLP vía pino); cookie consent; deshabilitado en dev local
- [x] `LOG_LEVEL` (env) y redacción de secretos en pino (incluye hook PostHog) — pendiente `requestId` (AsyncLocalStorage)
- [x] `handleApiError` centralizado en api-handler (red de seguridad en wrappers; las rutas conservan su manejo local)
- [ ] HTTP access logging
- [ ] Convenciones `action` + `logger.error` en transacciones de módulos críticos
- [ ] `docs/observability/logging.md`

---

## Principios que guían el roadmap

- Cada fase debe ser funcional y usable de forma independiente antes de empezar la siguiente.
- No se integra AFIP hasta que el flujo de ventas esté validado en uso real.
- La contabilidad es el último módulo porque necesita que todos los demás generen datos correctos.
- Se prioriza correctitud de datos financieros sobre velocidad de entrega.
