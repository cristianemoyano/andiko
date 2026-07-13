import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { bomReplaceSchema } from '@/modules/production/bom.schema'
import { getBom, replaceBom, deactivateBom } from '@/modules/production/boms.service'

export const GET = withPermission('production:read', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const bom = await getBom(id, orgScope.orgId)
    return NextResponse.json(bom)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'BOM_NOT_FOUND') {
      return NextResponse.json({ error: 'Receta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})

export const PATCH = withPermission('production:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body   = await req.json()
  const parsed = bomReplaceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const bom = await replaceBom(id, parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(bom)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BOM_NOT_FOUND')       return NextResponse.json({ error: 'Receta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'BOM_SELF_REFERENCE')  return NextResponse.json({ error: 'Un componente no puede ser el mismo producto terminado', code: 'BOM_SELF_REFERENCE' }, { status: 422 })
    }
    throw err
  }
})

export const DELETE = withPermission('production:delete', async (_req, ctx, session) => {
  const { id } = await ctx.params
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    await deactivateBom(id, orgScope.orgId, resolveActorId(session))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BOM_NOT_FOUND') return NextResponse.json({ error: 'Receta no encontrada', code: 'NOT_FOUND' }, { status: 404 })
      if (err.message === 'BOM_IN_USE')    return NextResponse.json({ error: 'La receta está en uso por una orden de producción activa', code: 'BOM_IN_USE' }, { status: 409 })
    }
    throw err
  }
})
