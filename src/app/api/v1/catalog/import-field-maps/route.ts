import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import {
  listCatalogImportFieldMaps,
  replaceCatalogImportFieldMaps,
} from '@/modules/catalog/catalog-import-field-map.service'

const querySchema = z.object({
  profile: z.string().max(64).optional(),
})

export const GET = withPermission('products:read', async (req, _ctx, session) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const profile =
      parsed.data.profile === undefined || parsed.data.profile === '' ? null : parsed.data.profile
    const rows = await listCatalogImportFieldMaps(ctx.orgId, profile)
    return NextResponse.json({
      data: rows.map((r) => ({
        external_header: r.external_header,
        internal_field_key: r.internal_field_key,
        profile: r.profile,
      })),
    })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

const putBodySchema = z.object({
  profile: z.string().max(64).nullable().optional(),
  maps: z.array(
    z.object({
      external_header: z.string().min(1).max(255),
      internal_field_key: z.string().min(1).max(64),
    }),
  ),
})

export const PUT = withPermission('products:write', async (req, _ctx, session) => {
  const body: unknown = await req.json()
  const parsed = putBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const ctx = await makeTenantContext(session.user)
    const prof =
      parsed.data.profile === undefined || parsed.data.profile === null || parsed.data.profile === ''
        ? null
        : parsed.data.profile
    await replaceCatalogImportFieldMaps(ctx.orgId, prof, parsed.data.maps)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'INVALID_INTERNAL_FIELD_KEY') {
      return NextResponse.json({ error: 'Clave interna no permitida', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    throw err
  }
})
