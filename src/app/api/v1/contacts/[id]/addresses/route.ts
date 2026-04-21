import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { contactAddressSchema } from '@/modules/contacts/contact-address.schema'
import { listAddresses, createAddress } from '@/modules/contacts/contact-address.service'

type P = { id: string }

export const GET = withPermission<P>('contacts:read', async (_req, ctx) => {
  const { id } = await ctx.params
  const addresses = await listAddresses(id)
  return NextResponse.json(addresses)
})

export const POST = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = contactAddressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const address = await createAddress(id, parsed.data, session.user.id!)
  return NextResponse.json(address, { status: 201 })
})
