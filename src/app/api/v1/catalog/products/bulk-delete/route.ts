import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { bulkDeleteProductsSchema } from '@/modules/catalog/products-bulk.schema'
import { deleteProductsBulk } from '@/modules/catalog/products.service'

export const POST = withPermission('products:delete', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = bulkDeleteProductsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const result = await deleteProductsBulk(parsed.data.ids, resolveActorId(session), ctxResult.ctx)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
