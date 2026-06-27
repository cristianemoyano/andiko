import type { Transaction } from 'sequelize'
import BillingMetric from './billing-metric.model'
import { TRACKED_BILLING_METRICS } from './billing-metrics.catalog'

/** Crea métricas del catálogo que aún no existen; no sobrescribe precios existentes. */
export async function syncCatalogMetrics(actorId: string, t?: Transaction) {
  let created = 0
  for (const def of TRACKED_BILLING_METRICS) {
    const [metric, wasCreated] = await BillingMetric.findOrCreate({
      where: { key: def.key },
      defaults: {
        key: def.key,
        label: def.label,
        unit_label: def.unit_label,
        unit_price: def.default_unit_price,
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    if (wasCreated) {
      created += 1
      continue
    }
    await metric.update({
      label: def.label,
      unit_label: def.unit_label,
      updated_by: actorId,
    }, { transaction: t })
  }
  return { created, total: TRACKED_BILLING_METRICS.length }
}
