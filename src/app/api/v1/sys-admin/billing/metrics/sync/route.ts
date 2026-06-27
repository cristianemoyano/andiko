import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { syncCatalogMetrics, listMetricsCatalog } from '@/modules/billing/billing-metrics.service'

/** Crea en billing_metrics las entradas del catálogo que aún no existen. */
export async function POST() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const result = await syncCatalogMetrics(gate.session.user!.id as string)
  const catalog = await listMetricsCatalog()
  return NextResponse.json({ ...result, catalog })
}
