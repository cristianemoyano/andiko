import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { productUpdateSchema } from '@/modules/catalog/product.schema'
import { getProduct, updateProduct, deleteProduct } from '@/modules/catalog/products.service'

type P = { id: string }

export const GET = withPermission<P>('products:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const product = await getProduct(id, session.user.orgId)
    return NextResponse.json(product)
  } catch {
    return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('products:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = productUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const product = await updateProduct(id, parsed.data, session.user.id!, session.user.orgId)
    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El SKU ya existe', code: 'DUPLICATE_SKU' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('products:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteProduct(id, session.user.id!, session.user.orgId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
