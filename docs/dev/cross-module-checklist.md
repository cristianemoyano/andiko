# Cross-Module Checklist

Usar **antes de merge** cuando un cambio toca más de un módulo o un flujo financiero/fiscal.

## ¿Cuándo aplica?

- Ventas, compras, inventario, AFIP, contabilidad, billing, POS o WooCommerce en el mismo PR
- Nueva columna en documento que afecta stock, saldos o CAE
- Nuevo endpoint que crea/actualiza más de una tabla de negocio

## Checklist

### Datos y transacciones

- [ ] Operación multi-tabla envuelta en `sequelize.transaction()`
- [ ] Toda query con `org_id` (y `branch_id` si branch-scoped) — ver [MULTITENANCY.md](../MULTITENANCY.md)
- [ ] `transaction` pasado a **cada** llamada Sequelize dentro del bloque
- [ ] Sin math de dinero con `number` — usar `Decimal.js`
- [ ] Migración reversible si hay cambio de schema

### Inventario

- [ ] Confirmar pedido / anular factura / devolución → `deductStock` / `restoreStock` / lotes FEFO
- [ ] Recepción compra confirmada → `applyMovement` tipo `in`
- [ ] Stock insuficiente devuelve error claro (no commit parcial)

### AFIP / fiscal

- [ ] Emisión CAE registra metering `afip_invoices_issued` si aplica
- [ ] Numeración fiscal coherente con secuencias internas
- [ ] Contingencia: cola `afip_emissions` si falla transporte

### Contabilidad

- [x] Factura emitida, cobro, recepción, pago a proveedor → asiento (además de devoluciones)
- [ ] Si un flujo nuevo no genera asiento, documentar en PR que el KPI contable no se actualiza

### API y UI

- [ ] Validación Zod en ruta antes del servicio
- [ ] Listados paginados (`LIMIT` obligatorio)
- [ ] Tras mutación en UI: `setRefresh(r => r + 1)` — no estado local optimista
- [ ] Errores inline, no solo toast

### Tests

- [ ] Test de servicio: happy path del cambio
- [ ] Si cruza módulos: integration test o test que mockea la cadena completa
- [ ] Edge case: stock cero, documento ya emitido, permiso denegado

### Documentación

- [ ] `docs/ROADMAP.md` actualizado si cierra o abre ítem de producto
- [ ] Este checklist marcado en el PR

## Flujos de referencia (deben seguir funcionando)

| Flujo | Verificación mínima |
|-------|---------------------|
| Pedido confirmado → stock OUT | Integration test o manual: stock baja en depósito correcto |
| Recepción confirmada → stock IN | Cantidad en `stock_items` / batches |
| Factura emitida → CAE (homologación) | Panel AFIP en detalle de factura |
| Devolución completada → stock + NC + asiento | Estados finales coherentes |
| Factura emitida / cobro / recepción de compra / pago a proveedor → asiento | `journal_entries.source_type` en `sales_invoice` / `sales_payment` / `purchase_invoice` / `purchase_payment`, debe = haber |
| POS sync → `sales_orders` + stock | Venta visible en ERP y stock actualizado |
| WooCommerce order → pedido + stock | `source=woocommerce`, sin doble descuento |

## Archivos de referencia

| Módulo | Servicio clave |
|--------|----------------|
| Ventas → stock | `src/modules/sales/sales-orders.service.ts` |
| Stock ledger | `src/modules/inventory/stock-movements.service.ts` |
| Compras → stock | `src/modules/purchases/purchase-receipts.service.ts` |
| AFIP | `src/modules/afip/afip-emission.service.ts` |
| Contabilidad devoluciones | `src/modules/accounting/sales-return-accounting.service.ts` |
| Contabilidad factura de venta / cobro | `src/modules/accounting/sales-invoice-accounting.service.ts`, `sales-payment-accounting.service.ts` |
| Contabilidad factura de compra / pago | `src/modules/accounting/purchase-invoice-accounting.service.ts`, `purchase-payment-accounting.service.ts` |
| Tenancy | `src/lib/tenancy.ts` |
