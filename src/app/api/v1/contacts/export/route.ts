import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listContacts } from '@/modules/contacts/contacts.service'
import { toCsvText } from '@/lib/csv'
import { CONTACT_CSV_HEADERS, contactToRow } from '@/modules/contacts/contacts-csv-adapter'

const EXPORT_LIMIT = 10_000

const exportQuerySchema = z.object({
  search: z.string().optional(),
  type:   z.enum(['customer', 'supplier', 'both']).optional(),
})

export const GET = withPermission('contacts:read', async (req, _ctx, session) => {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  const parsed = exportQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const result = await listContacts({ ...parsed.data, page: 1, limit: EXPORT_LIMIT }, ctx)
    const csv = toCsvText(
      result.data.map(c => contactToRow(c as Parameters<typeof contactToRow>[0])),
      CONTACT_CSV_HEADERS,
    )

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contactos.csv"',
      },
    })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
