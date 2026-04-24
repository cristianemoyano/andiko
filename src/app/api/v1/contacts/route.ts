import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { contactSchema, contactQuerySchema } from '@/modules/contacts/contact.schema'
import { listContacts, createContact } from '@/modules/contacts/contacts.service'

export const GET = withPermission('contacts:read', async (req, _ctx, session) => {
  const parsed = contactQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ctxTenant = await makeTenantContext(session.user)
    const result = await listContacts(parsed.data, ctxTenant)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('contacts:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctxTenant = await makeTenantContext(session.user)
    const contact = await createContact(parsed.data, ctxTenant, resolveActorId(session))
    return NextResponse.json(contact, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El CUIT ya existe', code: 'DUPLICATE_CUIT' }, { status: 409 })
    }
    throw err
  }
})
