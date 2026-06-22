import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPosDevice } from '@/lib/pos-auth'
import PosDevice from '@/modules/pos/pos-device.model'
import Branch from '@/modules/auth/branch.model'
import Organization from '@/modules/auth/organization.model'
import { getBalanzaConfig, getPosConfig } from '@/modules/pos/pos-config.service'
import { formatDateOnly } from '@/lib/date-only'

const querySchema = z.object({
  device_id: z.string().optional(),
})

const LICENSE_DURATION_DAYS = 30

export const GET = withPosDevice(async (req: NextRequest, ctx) => {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const device = await PosDevice.findOne({
    where: { org_id: ctx.orgId, device_id: ctx.deviceId, is_active: true },
  })

  if (!device) {
    return NextResponse.json({ valid: false, reason: 'Device not found or inactive' }, { status: 200 })
  }

  // null = admin revocó explícitamente la licencia — no renovar
  if (device.license_valid_until === null) {
    return NextResponse.json({ valid: false, reason: 'License revoked' }, { status: 200 })
  }

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + LICENSE_DURATION_DAYS)

  await device.update({ license_valid_until: validUntil })

  const [branch, org, balanza, posConfig] = await Promise.all([
    ctx.branchId
      ? Branch.findOne({
          where: { id: ctx.branchId },
          attributes: ['name', 'branch_code', 'address', 'punto_venta', 'establishment_code'],
        })
      : null,
    Organization.findOne({
      where: { id: ctx.orgId },
      attributes: [
        'name',
        'legal_name',
        'cuit',
        'iva_condition',
        'fiscal_address',
        'gross_income',
        'activity_start_date',
      ],
    }),
    getBalanzaConfig(ctx.orgId),
    getPosConfig(ctx.orgId),
  ])

  const effectivePuntoVenta = device.punto_venta ?? branch?.punto_venta ?? null

  return NextResponse.json({
    valid: true,
    org_id: ctx.orgId,
    org_name: org?.name ?? null,
    branch_id: ctx.branchId,
    branch_name: branch ? `${String(branch.branch_code).padStart(2, '0')} — ${branch.name}` : null,
    device_id: ctx.deviceId,
    device_name: device.name,
    valid_until: validUntil.toISOString(),
    features: ['sales', 'catalog_sync', 'customer_sync'],
    balanza_config: balanza,
    fiscal: org
      ? {
          legal_name: org.legal_name,
          trade_name: org.name,
          cuit: org.cuit,
          iva_condition: org.iva_condition,
          fiscal_address: org.fiscal_address,
          gross_income: org.gross_income ?? posConfig.ticket?.gross_income ?? null,
          activity_start_date: formatDateOnly(org.activity_start_date)
            ?? (posConfig.ticket?.activity_start_date ?? null),
          consumer_defense_line: posConfig.ticket?.consumer_defense_line ?? null,
          comprobante_codigo: posConfig.ticket?.comprobante_codigo ?? '083',
        }
      : null,
    branch_fiscal: branch
      ? {
          address: branch.address,
          establishment_code: branch.establishment_code,
          punto_venta: effectivePuntoVenta,
          branch_punto_venta: branch.punto_venta,
        }
      : null,
    device_fiscal: {
      punto_venta: device.punto_venta,
    },
  })
})
