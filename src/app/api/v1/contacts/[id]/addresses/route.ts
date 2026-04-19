import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactAddressSchema } from '@/modules/contacts/contact-address.schema'
import { listAddresses, createAddress } from '@/modules/contacts/contact-address.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
  const addresses = await listAddresses(id)
  return NextResponse.json(addresses)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = contactAddressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const address = await createAddress(id, parsed.data)
  return NextResponse.json(address, { status: 201 })
}
