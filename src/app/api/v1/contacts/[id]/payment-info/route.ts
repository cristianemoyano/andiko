import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { contactPaymentInfoSchema } from '@/modules/contacts/contact-payment-info.schema'
import { listPaymentInfo, createPaymentInfo } from '@/modules/contacts/contact-payment-info.service'

type P = { id: string }

export const GET = withPermission<P>('contacts:read', async (_req, ctx) => {
  const { id } = await ctx.params
  const items = await listPaymentInfo(id)
  return NextResponse.json(items.map((row) => row.toJSON()))
})

export const POST = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = contactPaymentInfoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const item = await createPaymentInfo(id, parsed.data, session.user.id!)
    return NextResponse.json(item.toJSON(), { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El CBU ya está registrado', code: 'DUPLICATE_CBU' }, { status: 409 })
    }
    throw err
  }
})
