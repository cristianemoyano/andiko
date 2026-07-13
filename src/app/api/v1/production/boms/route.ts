import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { resolveOrgScope } from '@/lib/session-org'
import { bomSchema, bomQuerySchema } from '@/modules/production/bom.schema'
import { listBoms, createBom } from '@/modules/production/boms.service'

export const GET = withPermission('production:read', async (req, _ctx, session) => {
  const parsed = bomQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const result = await listBoms(parsed.data, orgScope.orgId)
  return NextResponse.json(result)
})

export const POST = withPermission('production:write', async (req, _ctx, session) => {
  const body   = await req.json()
  const parsed = bomSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  try {
    const bom = await createBom(parsed.data, orgScope.orgId, resolveActorId(session))
    return NextResponse.json(bom, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'BOM_ALREADY_ACTIVE')  return NextResponse.json({ error: 'Ya existe una receta activa para esta variante', code: 'BOM_ALREADY_ACTIVE' }, { status: 409 })
      if (err.message === 'BOM_SELF_REFERENCE')  return NextResponse.json({ error: 'Un componente no puede ser el mismo producto terminado', code: 'BOM_SELF_REFERENCE' }, { status: 422 })
    }
    throw err
  }
})
