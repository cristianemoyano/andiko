/**
 * Catálogo de métricas que el ERP puede registrar en `usage_records`.
 * Fuente única: seed, validación al crear métricas y UI de sys-admin.
 */
export const TRACKED_BILLING_METRICS = [
  {
    key: 'afip_invoices_issued',
    label: 'Comprobantes AFIP emitidos',
    unit_label: 'comp.',
    default_unit_price: '15.00',
    description: 'Cada comprobante electrónico autorizado con CAE.',
    tracked_by: 'Automático al emitir AFIP',
  },
  {
    key: 'pos_tickets',
    label: 'Tickets POS',
    unit_label: 'ticket',
    default_unit_price: '5.00',
    description: 'Tickets de venta emitidos desde el punto de venta.',
    tracked_by: 'Pendiente de integración POS',
  },
  {
    key: 'storage_gb',
    label: 'Almacenamiento',
    unit_label: 'GB',
    default_unit_price: '200.00',
    description: 'Gigabytes de archivos adjuntos y documentos almacenados.',
    tracked_by: 'Automático al subir/eliminar archivos',
  },
  {
    key: 'storage_files',
    label: 'Archivos almacenados',
    unit_label: 'archivo',
    default_unit_price: '0.00',
    description: 'Cantidad de archivos almacenados (objetos). Medido; sin cargo por defecto.',
    tracked_by: 'Automático al subir/eliminar archivos',
  },
] as const

export type TrackedBillingMetricKey = (typeof TRACKED_BILLING_METRICS)[number]['key']

export const TRACKED_METRIC_KEYS = TRACKED_BILLING_METRICS.map(m => m.key) as TrackedBillingMetricKey[]

export type TrackedBillingMetricDef = (typeof TRACKED_BILLING_METRICS)[number]

const KEY_SET = new Set<string>(TRACKED_BILLING_METRICS.map(m => m.key))

export function isTrackedBillingMetricKey(key: string): key is TrackedBillingMetricKey {
  return KEY_SET.has(key)
}

export function getTrackedBillingMetric(key: string): TrackedBillingMetricDef | undefined {
  return TRACKED_BILLING_METRICS.find(m => m.key === key)
}

export type TrackedBillingMetricStatus = TrackedBillingMetricDef & {
  configured: boolean
}

/** Estado del catálogo vs claves ya presentes en billing_metrics (usable en cliente). */
export function buildTrackedMetricsCatalog(configuredKeys: ReadonlySet<string>): TrackedBillingMetricStatus[] {
  return TRACKED_BILLING_METRICS.map(def => ({
    ...def,
    configured: configuredKeys.has(def.key),
  }))
}

/** Clave usada al registrar consumo AFIP (evita strings sueltos en servicios). */
export const AFIP_INVOICES_ISSUED_METRIC_KEY: TrackedBillingMetricKey = 'afip_invoices_issued'

/** Claves de almacenamiento, registradas por el job de storage (gauge: snapshot por período). */
export const STORAGE_GB_METRIC_KEY: TrackedBillingMetricKey = 'storage_gb'
export const STORAGE_FILES_METRIC_KEY: TrackedBillingMetricKey = 'storage_files'
