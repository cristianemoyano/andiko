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
- [ ] Sistema de autenticación (NextAuth o similar)
- [ ] Roles y permisos básicos (admin, operador, solo lectura)
- [ ] Logger estructurado

---

## Fase 1 — Contactos

Base de datos de clientes y proveedores. Dependencia de todos los módulos siguientes.

**Entidades:** `contacts`, `contact_addresses`, `contact_fiscal_data`

- [ ] ABM de contactos (clientes y proveedores)
- [ ] Campos fiscales argentinos: CUIT, condición IVA (Responsable Inscripto, Monotributista, Consumidor Final, Exento), categoría fiscal
- [ ] Datos de pago: CBU, alias, banco
- [ ] Múltiples direcciones por contacto (entrega, fiscal, comercial)
- [ ] Búsqueda y filtros (por nombre, CUIT, tipo)
- [ ] Validación de CUIT (algoritmo de verificación)
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
