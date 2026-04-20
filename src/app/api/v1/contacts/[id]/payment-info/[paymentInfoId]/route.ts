import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactPaymentInfoUpdateSchema } from '@/modules/contacts/contact-payment-info.schema'
import { updatePaymentInfo, deletePaymentInfo } from '@/modules/contacts/contact-payment-info.service'

type Params = { params: Promise<{ id: string; paymentInfoId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { paymentInfoId } = await params
  const body = await req.json()
  const parsed = contactPaymentInfoUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const item = await updatePaymentInfo(paymentInfoId, parsed.data, session.user.id!)
    return NextResponse.json(item.toJSON())
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYMENT_INFO_NOT_FOUND') {
      return NextResponse.json({ error: 'Dato de pago no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El CBU ya está registrado', code: 'DUPLICATE_CBU' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { paymentInfoId } = await params
  try {
    await deletePaymentInfo(paymentInfoId, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'PAYMENT_INFO_NOT_FOUND') {
      return NextResponse.json({ error: 'Dato de pago no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
