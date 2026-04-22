import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { organizationCreateSchema } from '@/modules/auth/tenancy-admin.schema'
import { listOrganizationsAdmin, createOrganization } from '@/modules/auth/tenancy-admin.service'

export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const data = await listOrganizationsAdmin()
  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = organizationCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const org = await createOrganization(parsed.data)
    return NextResponse.json(org, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_SLUG_EXHAUSTED') {
      return NextResponse.json({ error: 'No se pudo generar un slug único', code: 'CONFLICT' }, { status: 409 })
    }
    throw err
  }
}
