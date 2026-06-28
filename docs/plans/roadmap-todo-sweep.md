# Plan: barrido de TODOs del roadmap (2026-06-10)

Objetivo: implementar todos los ítems pendientes implementables del `docs/ROADMAP.md`, en orden de valor/dependencia, con subagentes en paralelo sobre áreas disjuntas.

## Ya implementados (checkbox desactualizado — solo tildar)

- Contactos: importación CSV (`ImportModal` + `/api/v1/contacts/import` + `contacts-csv-adapter`)
- POS: renovación de licencia desde ERP admin (`DeviceEditModal` edita `license_valid_until`)

## Lote 1 (paralelo, sin migraciones)

1. Ventas: listado de cuentas corrientes por cliente (`/ventas/cuenta-corriente` — vista lista global)
2. Reportes de ventas: por período / cliente / producto (`/contabilidad/reportes/ventas`; legacy `/ventas/reportes` redirige)
3. Reportes de compras: por período / proveedor / categoría (`/contabilidad/reportes/compras`; legacy `/compras/reportes` redirige)
4. Compras: conciliación orden → recepción → factura (alertas de diferencias)
5. Design system: Checkbox, Switch, Tooltip, DropdownMenu, Card/Panel, Tabs, Select (+ stories)

## Lote 2 (migraciones, secuencial por área)

6. Catálogo: ajustes masivos de precios
7. Catálogo: datos de logística por SKU
8. Multitenancy: campos fiscales de org (columnas reales) + UI sys-admin
9. Multitenancy: `organization_settings` + guards por módulo/feature + mapa base/premium
10. Multitenancy: user_branches en lecturas + uniques scoped por org
11. Dashboard: actividad reciente ampliada + export PDF
12. POS: `GET /api/v1/pos/sales/sync` (pull reconciliación) + auto-sync background en Electron

## Lote 3 (módulos grandes)

13. Inventario: remitos de entrega
14. Inventario: lotes con FEFO (prerequisito devoluciones Fase C)
15. Ventas: templates de impresión configurables por org (editor visual como stretch)
16. Comunicaciones: email (config por org, envío de documentos, historial)
17. Contabilidad básica (plan de cuentas, asientos automáticos/manuales, balances) + conectar "Saldo en cuenta" del dashboard
18. Seeds dev ampliados (al final, cubriendo lo nuevo)

## Bloqueados (recursos externos — no implementables acá)

- AFIP/WSFE-WSAA (requiere certificados), firma de código macOS/Windows, íconos de la app POS (diseño), Chromatic (cuenta), electron-updater (requiere firma).
