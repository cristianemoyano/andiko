import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { contactAddressSchema } from '@/modules/contacts/contact-address.schema'
import { listAddresses, createAddress } from '@/modules/contacts/contact-address.service'

type P = { id: string }

export const GET = withPermission<P>('contacts:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const addresses = await listAddresses(id, ctxTenant)
    return NextResponse.json(addresses)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = contactAddressSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const ctxTenant = await makeTenantContext(session.user)
    const address = await createAddress(id, parsed.data, ctxTenant, session.user.id!)
    return NextResponse.json(address, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
