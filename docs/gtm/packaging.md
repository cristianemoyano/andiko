# Packaging y precios — Andiko Beta

Documento comercial interno. Precios en **ARS + IVA** (21%). Revisar trimestralmente por inflación.

**Motor en producto:** planes en `billing_plans` (sys-admin `/sys-admin/billing/planes`). Seed de referencia: `src/db/dev/seed-billing-plans.ts`.

---

## Posicionamiento

| Segmento | Competidor típico | Andiko |
|----------|-------------------|--------|
| Micro (solo factura) | Xubio, Alegra | Plan Inicial |
| PyME retail/distribución | FácilVirtual, Artics | Plan Profesional + POS |
| PyME mediana integral | Tango, Bejerman | Profesional + extras (futuro Enterprise) |

**Diferenciadores a comunicar:** cloud multi-sucursal, POS offline con sync, WooCommerce nativo, permisos granulares, PWA mobile.

---

## Planes estándar (catálogo seed)

### Inicial — `inicial_mensual`

Para comercios que empiezan a digitalizar: facturación, contactos y catálogo.

| Concepto | Incluido |
|----------|----------|
| **Precio base** | $24.900/mes + IVA |
| **Usuarios** | 3 incluidos · extra $3.500/usuario |
| **Sucursales** | 1 incluida · extra $8.000/sucursal |
| **Módulos** | Contactos, Catálogo, Ventas |
| **Add-ons módulo** | Inventario $4.500 · Compras $4.500 · Contabilidad $5.500 · POS $6.500 |
| **Sitios WooCommerce** | 0 incluidos · extra $6.000/sitio |
| **AFIP (CAE/mes)** | 50 incluidos · overage $15/comp. |
| **Storage** | Sin franquicia · $200/GB overage |

**Perfil cliente:** monotributo o RI chico, servicios o comercio sin control de stock formal.

---

### Profesional — `profesional_mensual`

Operación completa multisucursal.

| Concepto | Incluido |
|----------|----------|
| **Precio base** | $59.900/mes + IVA |
| **Usuarios** | 8 incluidos · extra $4.500/usuario |
| **Sucursales** | 3 incluidas · extra $6.000/sucursal |
| **Módulos** | Todos (contactos, catálogo, ventas, inventario, compras, contabilidad, POS) |
| **Sitios WooCommerce** | 1 incluido · extra $5.000/sitio |
| **AFIP (CAE/mes)** | 500 incluidos · overage $12/comp. |
| **Tickets POS/mes** | 1.000 incluidos · overage $4/ticket |
| **Storage** | 5 GB incluidos · overage $150/GB |
| **Extras incluidos** | Soporte WhatsApp, backup extendido |

**Perfil cliente:** autoservicio, distribuidor, retail 1–3 sucursales, Mendoza/Cuyo.

---

## Extras de servicio (no módulos)

| Extra | Precio referencia (Inicial) | Descripción |
|-------|----------------------------|-------------|
| Capacitación | $12.000 (único o mensual según acuerdo) | Onboarding presencial/remoto |
| Soporte WhatsApp | $5.000/mes | Prioridad horario comercial |
| Backup extendido | $3.000/mes | Retención y restauración asistida |

En Profesional: WhatsApp y backup **incluidos**.

---

## Política beta privada (clientes piloto)

Hasta definir pricing público en landing:

| Política | Detalle |
|----------|---------|
| **Descuento beta** | 30–50% sobre plan Profesional durante 6 meses, a cambio de feedback semanal |
| **Compromiso cliente** | Certificado AFIP en homologación → producción, 1 referente operativo, disponibilidad para calls quincenales |
| **Facturación** | Transferencia bancaria mensual; factura Andiko manual (sin CAE plataforma aún) |
| **Límites** | Respetar franquicias del plan; overage se informa antes de facturar |
| **Salida beta** | Aviso 60 días antes de pasar a lista; precio congelado 12 meses si firman anual |

### Paquetes beta sugeridos (Mendoza)

| Paquete | Plan base | Precio beta sugerido | Incluye |
|---------|-----------|----------------------|---------|
| **Comercio chico** | Inicial + Inventario | ~$35.000 + IVA | 1 sucursal, 3 usuarios, 100 CAE/mes |
| **Retail + caja** | Profesional | ~$40.000 + IVA | 1 sucursal, 5 usuarios, POS, 300 CAE/mes |
| **Distribuidor** | Profesional | ~$50.000 + IVA | 2 sucursales, 8 usuarios, compras + inventario |

Ajustar según rubro y volumen real del piloto.

---

## Cómo cotizar (fórmula)

```
Total mensual ≈ base_price
              + max(0, usuarios - included_seats) × per_seat_price
              + max(0, sucursales - included_branches) × per_branch_price
              + max(0, sitios_woo - included_sites) × per_site_price
              + Σ add-ons módulo habilitados (si no incluidos en plan)
              + Σ extras de servicio
              + overage métricas (CAE, POS, storage)
              + IVA 21%
```

Preview en sys-admin: suscripción → generar preview de período.

---

## Configuración en producto

1. Sys-admin → **Facturación → Planes** — verificar precios seed o editar.
2. **Organizaciones** → asignar suscripción al plan y seats.
3. `syncSubscriptionContractToOrg` habilita módulos según plan/add-ons.
4. Cliente ve consumo en **Configuración → Suscripción** (`/facturacion`).

---

## Pendientes comerciales (no bloquean beta)

- [ ] Precios públicos en landing
- [ ] Cobro automático (Mercado Pago)
- [ ] Factura electrónica Andiko → cliente (CAE plataforma)
- [x] Cron facturación recurrente
- [ ] Plan anual con descuento (10–15%)

---

## Comparativa rápida (referencia mercado 2026)

| Producto | Rango mensual aprox. | Notas |
|----------|----------------------|-------|
| Alegra / Xubio básico | $25K–$85K + IVA | Menos stock/POS |
| Contabilium PyME | ~$120K + IVA | Fuerte en facturación |
| FácilVirtual / Artics | Cotización custom | POS local, menos cloud |
| Tango Gestión | $500K+ + IVA | Implementación cara |
| **Andiko Profesional** | **$59.900 + IVA** | Cloud + POS + multi-sucursal |

Fuentes sectoriales: guías de software AR 2026; validar con cotización real antes de cada cierre.
