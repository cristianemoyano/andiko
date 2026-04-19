import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactAddressUpdateSchema } from '@/modules/contacts/contact-address.schema'
import { updateAddress, deleteAddress } from '@/modules/contacts/contact-address.service'

type Params = { params: Promise<{ id: string; addressId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { addressId } = await params
  const body = await req.json()
  const parsed = contactAddressUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const address = await updateAddress(addressId, parsed.data)
    return NextResponse.json(address)
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Dirección no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { addressId } = await params
  try {
    await deleteAddress(addressId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Dirección no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
