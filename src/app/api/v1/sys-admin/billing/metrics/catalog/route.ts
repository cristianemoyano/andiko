import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { listMetricsCatalog } from '@/modules/billing/billing-metrics.service'

/** Catálogo de métricas trackeadas por el ERP y estado de configuración en billing_metrics. */
export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const catalog = await listMetricsCatalog()
  return NextResponse.json({ data: catalog })
}
