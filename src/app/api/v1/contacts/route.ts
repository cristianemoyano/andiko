import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { contactSchema, contactQuerySchema } from '@/modules/contacts/contact.schema'
import { listContacts, createContact } from '@/modules/contacts/contacts.service'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const parsed = contactQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await listContacts(parsed.data)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json()
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const contact = await createContact(parsed.data, session.user.id!)
    return NextResponse.json(contact, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('unique')) {
      return NextResponse.json({ error: 'El CUIT ya existe', code: 'DUPLICATE_CUIT' }, { status: 409 })
    }
    throw err
  }
}
