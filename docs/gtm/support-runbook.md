# Runbook — Soporte al cliente

Operación día a día para beta y primeros clientes de pago.

---

## Canales y SLA (beta)

| Severidad | Ejemplos | Canal | SLA respuesta | SLA resolución objetivo |
|-----------|----------|-------|---------------|-------------------------|
| **S1 Crítico** | ERP caído, no factura AFIP, pérdida de datos | WhatsApp + tel | 2 h hábiles | 8 h |
| **S2 Alto** | POS no sync, stock incorrecto post-venta, no cobra | WhatsApp / email | 4 h hábiles | 24 h |
| **S3 Medio** | Reporte incorrecto, UI confusa, permisos | Email | 1 día hábil | 5 días |
| **S4 Bajo** | Mejora, capacitación extra | Email / backlog | 3 días hábiles | Roadmap |

Horario beta: Lun–Vie 9–18 ART (Mendoza). Fuera de horario: solo S1 vía WhatsApp acordado.

---

## Triaje inicial (preguntas)

1. ¿Qué org/sucursal? (nombre comercial)
2. ¿Qué usuario y rol?
3. ¿Qué intentaba hacer? (paso a paso)
4. ¿Mensaje de error exacto? (screenshot)
5. ¿Desde cuándo? ¿Funcionaba antes?
6. ¿ERP web, POS, o ambos?

---

## Playbooks por síntoma

### Emails no llegan / van a spam

1. Verificar SMTP en `/sys-admin/email` (host `mailserver`, puerto 587, cuenta `erp@andiko.cloud`)
2. En VPS: `make prod-mail-check` — DNS (MX, SPF, DKIM, DMARC, PTR) y puertos
3. Score: [mail-tester.com](https://www.mail-tester.com) desde buzón del equipo
4. Logs: `make prod-mail-logs` o Portainer → `andiko_mailserver`
5. Runbook completo: [mail-server.md](../deployment/mail-server.md)

### No puede emitir AFIP / error CAE

1. Verificar `AFIP_MODE` en prod = `produccion` o `homologacion` (no `stub`)
2. Org → Configuración → AFIP: certificado vigente, PV correcto
3. Revisar cola contingencia `/configuracion` o API `afip/contingency`
4. Logs: error WSFE en respuesta API
5. Si certificado vencido → cliente renueva en AFIP y recarga PEM

### Stock no coincide

1. Confirmar pedido **confirmado** (no solo borrador)
2. Depósito de la sucursal del documento
3. Movimientos en `/inventario/movimientos` filtrados por variante
4. WooCommerce/POS: ventas duplicadas por re-sync → revisar `source` y idempotencia
5. Lotes FEFO: ver batches en depósito

### POS no sincroniza

1. Conexión a internet en caja
2. Licencia dispositivo vigente (`license_valid_until`)
3. Settings POS → "Enviar ventas pendientes"
4. Error por registro en UI de sync
5. ERP `/pos/dispositivos` — `last_seen_at` actualizado

### Usuario sin permiso / módulo no visible

1. Matriz de roles en `/organizaciones/[id]` o configuración org
2. `enabled_modules` en suscripción vs plan
3. `user_branches` — sucursal asignada
4. `sales:scope_own` — vendedor solo ve propias

### Panel / KPI no cuadra

1. Filtro período y sucursal en URL
2. **Saldo en cuenta** contable: asientos automáticos de ventas aún no implementados — explicar al cliente
3. Cache 60s en endpoints panel — refrescar

---

## Escalación interna

| Nivel | Quién | Cuándo |
|-------|-------|--------|
| L1 | Implementador / fundador | Triaje y workarounds |
| L2 | Dev backend | Bug reproducible en servicio, datos |
| L3 | Dev full-stack + DB | Migración, corrupción, tenancy |

Antes de tocar prod DB: backup + impersonar en staging si existe.

---

## Herramientas sys-admin

| Tarea | Ruta |
|-------|------|
| Ver org | `/sys-admin/organizaciones` |
| Impersonar usuario | Menú mobile / sidebar sys-admin |
| Facturación servicio | `/sys-admin/billing` |
| Email plataforma | `/sys-admin/email` |
| Mail server (ops) | [mail-server.md](../deployment/mail-server.md), `make prod-mail-check` |
| Storage | `/sys-admin/storage` |
| Health | `GET /api/health` |

---

## Comunicación al cliente

Plantilla cierre ticket:

```
Hola [nombre],

[Resumen del problema y causa]

Acción realizada: [fix / workaround / próximo deploy]

Por favor confirmá que podés [acción de verificación].

Próximos pasos (si aplica): […]

Saludos,
Equipo Andiko
```

---

## Post-mortem (S1/S2)

Dentro de 48 h de resuelto:

1. Causa raíz
2. ¿Faltó test integration?
3. ¿Doc desactualizada?
4. Acción preventiva (issue + PR)

Registrar en changelog interno o ROADMAP si revela gap de producto.

---

## Documentos relacionados

- [client-onboarding-runbook.md](client-onboarding-runbook.md)
- [packaging.md](packaging.md)
- [../deployment/production.md](../deployment/production.md)
- [../dev/cross-module-checklist.md](../dev/cross-module-checklist.md)
