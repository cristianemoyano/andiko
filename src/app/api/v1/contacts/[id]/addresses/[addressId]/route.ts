import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { contactAddressUpdateSchema } from '@/modules/contacts/contact-address.schema'
import { updateAddress, deleteAddress } from '@/modules/contacts/contact-address.service'

type P = { id: string; addressId: string }

export const PATCH = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { addressId } = await ctx.params
  const body = await req.json()
  const parsed = contactAddressUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const address = await updateAddress(addressId, parsed.data, session.user.id!)
    return NextResponse.json(address)
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Dirección no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('contacts:delete', async (_req, ctx, session) => {
  const { addressId } = await ctx.params
  try {
    await deleteAddress(addressId, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Dirección no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
