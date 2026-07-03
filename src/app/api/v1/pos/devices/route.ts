import { NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import PosDevice from '@/modules/pos/pos-device.model'
import { hashPosToken } from '@/lib/pos-token'

const createDeviceSchema = z.object({
  device_id: z.string().min(1).max(128),
  name: z.string().max(128).optional(),
  branch_id: z.string().uuid().optional(),
})

export const GET = withPermission('contacts:read', async (req, _ctx, session) => {
  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const devices = await PosDevice.findAll({
      where: { org_id: ctx.orgId, deleted_at: null },
      attributes: [
        'id', 'device_id', 'name', 'branch_id', 'is_active',
        'last_seen_at', 'license_valid_until', 'punto_venta', 'created_at',
      ],
      order: [['created_at', 'DESC']],
    })
    return NextResponse.json({ data: devices, count: devices.length })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('contacts:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createDeviceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const apiToken = randomBytes(32).toString('hex')

    const initialLicense = new Date()
    initialLicense.setDate(initialLicense.getDate() + 30)

    const device = await PosDevice.create({
      org_id: ctx.orgId,
      branch_id: parsed.data.branch_id ?? ctx.defaultBranchId ?? null,
      device_id: parsed.data.device_id,
      name: parsed.data.name ?? null,
      api_token_hash: hashPosToken(apiToken),
      is_active: true,
      license_valid_until: initialLicense,
    })

    return NextResponse.json(
      {
        id: device.id,
        device_id: device.device_id,
        name: device.name,
        branch_id: device.branch_id,
        api_token: apiToken,
        created_at: device.created_at,
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message.includes('uq_pos_devices')) {
      return NextResponse.json({ error: 'Device ID ya registrado', code: 'DUPLICATE_DEVICE' }, { status: 409 })
    }
    throw err
  }
})
