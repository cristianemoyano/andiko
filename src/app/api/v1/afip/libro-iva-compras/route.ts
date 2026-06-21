import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext } from '@/lib/tenancy'
import { libroIvaQuerySchema } from '@/modules/afip/afip.schema'
import { buildLibroIvaCompras } from '@/modules/afip/libro-iva-compras.service'

export const GET = withPermission('purchases:read', async (req, _ctx, session) => {
  const parsed = libroIvaQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const ctx = await makeTenantContext(session.user)
  const result = await buildLibroIvaCompras(ctx, parsed.data)
  return NextResponse.json(result)
})
