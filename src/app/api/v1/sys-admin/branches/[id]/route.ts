import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { branchUpdateSchema } from '@/modules/auth/tenancy-admin.schema'
import { updateBranch } from '@/modules/auth/tenancy-admin.service'
import { deleteBranchWithGuard } from '@/modules/auth/org-users.service'
import Branch from '@/modules/auth/branch.model'

type P = { id: string }

export async function PATCH(req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = branchUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const branch = await updateBranch(id, parsed.data)
    return NextResponse.json(branch)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'BRANCH_NOT_FOUND') {
      return NextResponse.json({ error: 'Sucursal no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<P> }) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  const { id } = await ctx.params
  try {
    const branch = await Branch.findByPk(id)
    if (!branch) {
      return NextResponse.json({ error: 'Sucursal no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    await deleteBranchWithGuard(branch.org_id, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'BRANCH_NOT_FOUND') {
      return NextResponse.json({ error: 'Sucursal no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    if (err instanceof Error && err.message === 'LAST_BRANCH') {
      return NextResponse.json(
        { error: 'No podés eliminar la última sucursal activa de la organización', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    }
    throw err
  }
}
