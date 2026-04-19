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
- [ ] Roles y permisos a nivel de recurso (guardas por módulo)
- [ ] Página de perfil de usuario

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
- [ ] Textarea
- [ ] Checkbox y Switch
- [ ] Badge / StatusBadge (para estados de documentos ERP)
- [ ] Tooltip
- [ ] Modal / Dialog (con focus trap)
- [ ] Dropdown Menu

### Componentes de layout
- [ ] PageHeader (título + breadcrumb + acciones)
- [ ] Card / Panel
- [ ] Sidebar (navegación principal)
- [ ] Tabs

### Componentes ERP-específicos
- [ ] DataTable (columnas configurables, sorting, paginación, row actions)
- [ ] CurrencyInput (formato ARS, separador de miles, decimales)
- [ ] DatePicker (formato DD/MM/YYYY, Argentina)
- [ ] FormField (label + input + mensaje de error — envuelve cualquier control)
- [ ] SearchableSelect (para seleccionar contactos, productos en formularios)
- [ ] TotalsFooter (subtotal / IVA / total en formularios de factura)
- [ ] EmptyState (pantalla vacía con acción primaria)
- [ ] ConfirmDialog (para acciones destructivas)

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
- [x] API REST: `GET /api/v1/contacts`, `POST /api/v1/contacts`
- [x] API REST: `GET /api/v1/contacts/:id`, `PATCH /api/v1/contacts/:id`, `DELETE /api/v1/contacts/:id`
- [x] Tests unitarios para `contact.utils.ts` (validateCuit, formatCuit)

### Frontend (pendiente)
- [ ] Listado de contactos con DataTable (búsqueda, filtros, paginación)
- [ ] Formulario de creación/edición de contacto
- [ ] Vista detalle de contacto
- [ ] Datos de pago: CBU, alias, banco
- [ ] Múltiples direcciones por contacto (entrega, fiscal, comercial)
- [ ] Importación desde CSV

---

## Fase 2 — Catálogo

Productos y servicios. Requisito mínimo para facturar.

**Entidades:** `products`, `product_categories`, `price_lists`, `price_list_items`

- [ ] ABM de productos y servicios
- [ ] Categorías y subcategorías
- [ ] Unidades de medida (kg, unidad, hora, etc.)
- [ ] Código interno y código de barras
- [ ] Alícuota IVA por producto (0%, 10.5%, 21%, 27%)
- [ ] Listas de precios (múltiples listas por cliente/canal)
- [ ] Historial de precios

---

## Fase 3 — Ventas

Flujo principal de negocio: presupuesto → pedido → factura → cobro.
Sin integración AFIP en esta fase — documentos internos únicamente.

**Entidades:** `sales_quotes`, `sales_orders`, `invoices`, `invoice_items`, `payments`

- [ ] Presupuestos con vigencia y estado
- [ ] Conversión presupuesto → pedido → factura en un flujo
- [ ] Cálculo automático de IVA discriminado por alícuota
- [ ] Descuentos por ítem y por documento
- [ ] Condiciones de pago (contado, 30/60/90 días)
- [ ] Registro de cobros parciales y totales
- [ ] Estados de factura: borrador, emitida, cobrada, anulada
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
