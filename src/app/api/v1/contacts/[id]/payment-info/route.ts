import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactPaymentInfoSchema } from '@/modules/contacts/contact-payment-info.schema'
import { listPaymentInfo, createPaymentInfo } from '@/modules/contacts/contact-payment-info.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
  const items = await listPaymentInfo(id)
  return NextResponse.json(items.map((row) => row.toJSON()))
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
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
}
