import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { toCsvText } from '@/lib/csv'
import { trialBalanceQuerySchema } from '@/modules/accounting/journal-entry.schema'
import { getTrialBalance } from '@/modules/accounting/reports.service'
import { SUMAS_Y_SALDOS_CSV_HEADERS, trialBalanceToCsvRows } from '@/modules/accounting/accounting-export.service'

export const GET = withPermission('accounting:read', async (req, _ctx, session) => {
  const parsed = trialBalanceQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const balance = await getTrialBalance(parsed.data, tenantResult.ctx)
  const rows = trialBalanceToCsvRows(balance.rows)
  rows.push({
    codigo: '',
    cuenta: 'Totales',
    sumas_debe: balance.totals.total_debit,
    sumas_haber: balance.totals.total_credit,
    saldo_deudor: balance.totals.saldo_debit,
    saldo_acreedor: balance.totals.saldo_credit,
  })
  const csv = toCsvText(rows, SUMAS_Y_SALDOS_CSV_HEADERS)
  const suffix = [parsed.data.from, parsed.data.to].filter(Boolean).join('_') || 'completo'

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sumas-y-saldos-${suffix}.csv"`,
    },
  })
})
