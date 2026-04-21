import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { contactUpdateSchema } from '@/modules/contacts/contact.schema'
import { getContact, updateContact, deleteContact } from '@/modules/contacts/contacts.service'

type P = { id: string }

export const GET = withPermission<P>('contacts:read', async (_req, ctx) => {
  const { id } = await ctx.params
  try {
    const contact = await getContact(id)
    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: 'Contacto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
})

export const PATCH = withPermission<P>('contacts:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json()
  const parsed = contactUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const contact = await updateContact(id, parsed.data, session.user.id!)
    return NextResponse.json(contact)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Contacto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const DELETE = withPermission<P>('contacts:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  try {
    await deleteContact(id, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Contacto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
