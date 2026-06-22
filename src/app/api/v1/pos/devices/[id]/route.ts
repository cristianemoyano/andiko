import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import PosDevice from '@/modules/pos/pos-device.model'

const patchSchema = z.object({
  license_valid_until: z.string().datetime({ offset: true }).nullable().optional(),
  name: z.string().max(128).optional(),
  is_active: z.boolean().optional(),
  punto_venta: z.number().int().positive().max(99999).nullable().optional(),
})

async function resolveDevice(id: string, orgId: string) {
  const device = await PosDevice.findOne({ where: { id, org_id: orgId } })
  return device
}

export const PATCH = withPermission(
  'contacts:write',
  async (req: NextRequest, ctx, session) => {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
    }

    try {
      const tenantCtx = await makeTenantContext(session.user)
      const device = await resolveDevice(id, tenantCtx.orgId)
      if (!device) return NextResponse.json({ error: 'Dispositivo no encontrado', code: 'NOT_FOUND' }, { status: 404 })

      const updates: Partial<{
        name: string | null
        is_active: boolean
        license_valid_until: Date | null
        punto_venta: number | null
      }> = {}
      if (parsed.data.name !== undefined) updates.name = parsed.data.name
      if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active
      if ('license_valid_until' in parsed.data) {
        updates.license_valid_until = parsed.data.license_valid_until
          ? new Date(parsed.data.license_valid_until)
          : null
      }
      if ('punto_venta' in parsed.data) {
        updates.punto_venta = parsed.data.punto_venta ?? null
      }

      await device.update(updates)
      return NextResponse.json({
        ok: true,
        punto_venta: device.punto_venta,
      })
    } catch (err) {
      if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      throw err
    }
  },
)

export const DELETE = withPermission(
  'contacts:write',
  async (_req, ctx, session) => {
    const { id } = await ctx.params

    try {
      const tenantCtx = await makeTenantContext(session.user)
      const device = await resolveDevice(id, tenantCtx.orgId)
      if (!device) return NextResponse.json({ error: 'Dispositivo no encontrado', code: 'NOT_FOUND' }, { status: 404 })

      await device.destroy()
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      throw err
    }
  },
)
