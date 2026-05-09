import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { accountStatementQuerySchema } from '@/modules/sales/account-statement.schema'
import { getSupplierAccountStatement } from '@/modules/purchases/supplier-account-statement.service'

type P = { id: string }

export const GET = withPermission<P>('purchases:read', async (req, ctx, session) => {
  const { id } = await ctx.params
  const parsed = accountStatementQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const tenantCtx = await makeTenantContext(session.user)
    const statement = await getSupplierAccountStatement(id, parsed.data, tenantCtx)
    return NextResponse.json(statement)
  } catch (err: unknown) {
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      if (err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
        return NextResponse.json({ error: 'No tenés acceso a esa sucursal.', code: err.code }, { status: 403 })
      }
    }

    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Proveedor no encontrado', code: 'CONTACT_NOT_FOUND' }, { status: 404 })
    }

    throw err
  }
})
