# Programa Beta Privada — Andiko

## Objetivo

Validar el ERP con clientes reales en Mendoza/Argentina antes del lanzamiento comercial amplio: flujos diarios, AFIP en producción, POS en local, y feedback para estabilizar integraciones cross-módulo.

## Criterios de admisión

| Criterio | Requerido |
|----------|-----------|
| Rubro | Retail, distribución, comercio con stock o e-commerce WooCommerce |
| Tamaño | 3–25 empleados, 1–3 sucursales |
| Facturación | Responsable Inscripto o Monotributo con necesidad de comprobantes |
| Referente | 1 dueño/gerente + 1 operativo (cajero/administrativo) |
| Compromiso | 4–8 semanas de uso real + reunión de feedback quincenal (30 min) |
| Exclusión temporal | Solo facturación sin stock (mejor Xubio); producción industrial; multi-empresa |

## Fases del programa

### Fase 1 — Piloto (2–3 clientes)

- Acompañamiento mano a mano (onboarding asistido)
- Precio beta según [packaging.md](packaging.md)
- AFIP: homologación obligatoria antes de producción
- Canal soporte: WhatsApp directo al fundador + email

### Fase 2 — Beta ampliada (5–10 clientes)

- Onboarding semi-automatizado (wizard + checklist)
- Soporte según [support-runbook.md](support-runbook.md)
- CI + integration tests en `develop` obligatorios

### Fase 3 — GA (general availability)

- Pricing público en landing
- SLA estándar
- Cobro automatizado (cuando exista gateway)

## Compromisos Andiko

- Respuesta soporte crítico: &lt; 4 h hábiles (beta)
- Fixes de bugs bloqueantes: prioridad sobre features nuevas
- Comunicación proactiva si hay deploy o migración que requiera ventana
- No vender datos; backup diario en infra prod (ver deployment runbook)

## Compromisos del cliente beta

- Usar el sistema para operación real (no solo prueba)
- Reportar bugs con pasos reproducibles
- Participar en feedback quincenal
- Autorizar uso de logo/testimonial al finalizar beta (opcional)
- Mantener certificado AFIP vigente

## Métricas de éxito

| Métrica | Meta beta |
|---------|-----------|
| Uptime ERP | &gt; 99% mensual |
| Facturas emitidas con CAE sin error | &gt; 95% |
| POS sync exitoso | &gt; 98% ventas |
| NPS del referente | ≥ 7 |
| Churn beta | &lt; 20% |

## Salida de beta

60 días antes del fin del período beta:

1. Comunicar nuevo precio de lista
2. Ofrecer anual con 10–15% descuento
3. Migrar suscripción en sys-admin al plan definitivo
4. Solicitar testimonial o caso de uso

## Documentos relacionados

- [packaging.md](packaging.md) — precios y planes
- [client-onboarding-runbook.md](client-onboarding-runbook.md) — alta operativa
- [support-runbook.md](support-runbook.md) — soporte día a día
