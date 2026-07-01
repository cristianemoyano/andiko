# Runbook — Onboarding de cliente

Checklist operativo desde firma verbal hasta **primer día productivo**. Responsable: fundador o implementador asignado.

**Tiempo estimado:** 3–5 días hábiles (beta asistida).

---

## Pre-requisitos (antes de crear la org)

| # | Ítem | Cliente provee | Andiko verifica |
|---|------|----------------|-----------------|
| 1 | CUIT y razón social | ✓ | Constancia AFIP / datos fiscales |
| 2 | Condición IVA | ✓ | Coherente con tipo de factura |
| 3 | Domicilio fiscal | ✓ | Para templates de impresión |
| 4 | Certificado AFIP (.pem + key) | ✓ | Carga en homologación primero |
| 5 | Punto de venta AFIP | ✓ | Por sucursal |
| 6 | Lista de usuarios (email, rol) | ✓ | Máx. según plan |
| 7 | Rubro y flujos críticos | ✓ | Venta mostrador / distribución / e-commerce |

---

## Día 0 — Alta en plataforma (sys-admin)

1. **Crear organización** en `/sys-admin/organizaciones`
   - Slug inmutable (ej. `cliente-ejemplo`)
   - Datos fiscales completos
2. **Sucursales** — al menos una con `branch_code` y dirección
3. **Usuarios** — Gerente + operadores; PIN POS si aplica cajero
4. **Suscripción** — asignar plan según [packaging.md](packaging.md)
   - Verificar módulos habilitados (`enabled_modules`)
5. **Emisor plataforma** — datos Andiko en `/sys-admin/billing/emisor` (para facturas de servicio)
6. **SMTP** — `/sys-admin/email` probado con email de prueba

Registrar en hoja interna: org_id, plan, precio beta, fecha inicio, referente contacto.

---

## Día 1 — Wizard onboarding (cliente / Gerente)

El Gerente ingresa con su usuario y completa `/onboarding`:

| Paso | Contenido | Validación |
|------|-----------|------------|
| Datos fiscales org | CUIT, IVA, domicilio | Coincide con AFIP |
| Módulos | Según contrato | No habilitar premium sin plan |
| Catálogo | Import CSV o carga manual | Al menos 10 SKU críticos |
| Contactos | Cliente genérico + proveedores clave | CUIT válidos |
| AFIP | Certificado, PV, modo homologación | Test emitir factura B/C |
| Usuarios | Invitar equipo | Roles correctos |

**Gate:** no pasar a producción AFIP hasta 1 factura exitosa en homologación.

---

## Día 2 — Inventario y compras (si aplica plan)

1. Crear **depósito** por sucursal (regla: 1 warehouse por branch)
2. Carga inicial de stock (CSV catálogo o ajuste manual)
3. Configurar **mínimos** y alertas si el cliente controla reposición
4. Demo flujo: OC → recepción → stock IN
5. Si hay proveedor recurrente: contacto tipo proveedor + condición pago

---

## Día 3 — Ventas y cobros

1. Lista de precios default asignada
2. Flujo demo: presupuesto → pedido → factura → cobro
3. **Emitir AFIP** en homologación desde detalle de factura
4. Impresión / envío email de comprobante
5. Cuenta corriente: verificar saldo en `/ventas/cuenta-corriente`

---

## Día 4 — POS (si aplica)

1. Crear dispositivo en `/pos/dispositivos` — guardar **api_token** de forma segura
2. Instalar app POS en caja (Windows preferido en beta)
3. Vincular sucursal y renovar licencia
4. Sync catálogo + clientes + medios de pago
5. Venta de prueba + sync cloud
6. Turno de caja: apertura → ventas → cierre
7. Si AFIP en ticket: autorizar en homologación

**Nota:** sin firma de código Windows, preparar al cliente para SmartScreen ("Más información" → Ejecutar).

---

## Día 5 — Go-live y capacitación

| Sesión | Duración | Contenido |
|--------|----------|-------------|
| Gerente | 1 h | Panel, reportes, usuarios, configuración |
| Operativo ventas | 1 h | Facturar, cobrar, NC, devoluciones |
| Depósito | 45 min | Recepciones, ajustes, reposición |
| Cajero | 45 min | POS, cierre caja, reintentos sync |

Entregar:
- Accesos y URL: `https://andiko.cloud`
- Contacto soporte (WhatsApp beta)
- Link a este runbook resumido (1 página PDF opcional)

---

## Post go-live — Semana 1

| Día | Acción |
|-----|--------|
| 1 | Llamada 15 min — ¿pudieron facturar? |
| 3 | Revisar logs AFIP / errores sync POS |
| 5 | Reunión feedback 30 min — bugs y fricciones |
| 7 | AFIP **producción** si homologación OK y cliente listo |

---

## Checklist de salida onboarding

- [ ] Org con suscripción activa y módulos correctos
- [ ] ≥ 1 usuario Gerente capacitado
- [ ] Catálogo y stock inicial cargados
- [ ] 1 factura AFIP homologación exitosa
- [ ] (POS) 1 venta sincronizada
- [ ] (WooCommerce) sitio vinculado y pedido de prueba
- [ ] Cliente sabe a quién escribir por soporte
- [ ] Próxima reunión de feedback agendada

---

## Rollback / contingencia

| Escenario | Acción |
|-----------|--------|
| AFIP caído | Modo contingencia + cola reintentos |
| POS sin internet | Ventas locales; sync manual desde Settings |
| Bug bloqueante | Impersonar org (sys-admin), hotfix prioritario |
| Migración fallida | No deploy; restaurar backup DB según [production.md](../deployment/production.md) |
