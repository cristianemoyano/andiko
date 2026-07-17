import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { resolveTenantContext } from '@/lib/tenancy'
import { toCsvText } from '@/lib/csv'
import { trialBalanceQuerySchema } from '@/modules/accounting/journal-entry.schema'
import { getLibroDiarioRows, LIBRO_DIARIO_CSV_HEADERS } from '@/modules/accounting/accounting-export.service'

export const GET = withPermission('accounting:read', async (req, _ctx, session) => {
  const parsed = trialBalanceQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const tenantResult = await resolveTenantContext(session.user)
  if ('error' in tenantResult) return tenantResult.error

  const rows = await getLibroDiarioRows(parsed.data, tenantResult.ctx)
  const csv = toCsvText(rows, LIBRO_DIARIO_CSV_HEADERS)
  const suffix = [parsed.data.from, parsed.data.to].filter(Boolean).join('_') || 'completo'

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="libro-diario-${suffix}.csv"`,
    },
  })
})
