import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { salesQuoteUpdateSchema } from '@/modules/sales/sales-quote.schema'
import { getQuote, updateQuote, deleteQuote } from '@/modules/sales/sales-quotes.service'

type P = { id: string }

export const GET = withPermission<P>('sales:read', async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const quote = await getQuote(id)
    return NextResponse.json(quote)
  } catch {
    return NextResponse.json({ error: 'Presupuesto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('sales:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = salesQuoteUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const quote = await updateQuote(id, parsed.data, session.user.id!)
    return NextResponse.json(quote)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'QUOTE_NOT_FOUND')     return NextResponse.json({ error: 'Presupuesto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'QUOTE_NOT_EDITABLE')  return NextResponse.json({ error: 'El presupuesto no es editable', code: 'NOT_EDITABLE' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('sales:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteQuote(id, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'QUOTE_NOT_FOUND')     return NextResponse.json({ error: 'Presupuesto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'QUOTE_NOT_DELETABLE') return NextResponse.json({ error: 'No se puede eliminar un presupuesto aceptado', code: 'NOT_DELETABLE' }, { status: 409 })
    }
    throw err
  }
})
