import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactUpdateSchema } from '@/modules/contacts/contact.schema'
import { getContact, updateContact, deleteContact } from '@/modules/contacts/contacts.service'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
  try {
    const contact = await getContact(id)
    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: 'Contacto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
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
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await params
  try {
    await deleteContact(id, session.user.id!)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'CONTACT_NOT_FOUND') {
      return NextResponse.json({ error: 'Contacto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}
