import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { branchCreateSchema } from '@/modules/auth/tenancy-admin.schema'
import { createBranch } from '@/modules/auth/tenancy-admin.service'

type P = { id: string }

export async function POST(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id: orgId } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = branchCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const branch = await createBranch(orgId, parsed.data)
    return NextResponse.json(branch, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ORG_NOT_FOUND') {
      return NextResponse.json({ error: 'Organización no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'BRANCH_CODE_EXHAUSTED') {
      return NextResponse.json(
        { error: 'Se alcanzó el máximo de sucursales numerables para esta organización.', code: 'BRANCH_CODE_EXHAUSTED' },
        { status: 409 },
      )
    }
    throw err
  }
}
