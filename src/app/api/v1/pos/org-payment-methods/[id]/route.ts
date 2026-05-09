import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { UniqueConstraintError } from 'sequelize'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { PosPaymentMethod, PosBranchPaymentMethod, POS_PAYMENT_METHOD_TYPES } from '@/modules/pos/pos-payment-method.model'

const updateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  type: z.enum([...POS_PAYMENT_METHOD_TYPES]).optional(),
  requires_reference: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  branch_ids: z.array(z.string().uuid()).optional(),
})

export const PATCH = withPermission('contacts:write', async (req: NextRequest, { params }, session) => {
  const { id } = await params
  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const method = await PosPaymentMethod.findOne({ where: { id, org_id: ctx.orgId } })
    if (!method) return NextResponse.json({ error: 'No encontrado', code: 'NOT_FOUND' }, { status: 404 })

    const { branch_ids, ...methodData } = parsed.data
    await method.update(methodData)

    if (branch_ids !== undefined) {
      await PosBranchPaymentMethod.destroy({ where: { pos_payment_method_id: id, org_id: ctx.orgId } })
      if (branch_ids.length > 0) {
        await PosBranchPaymentMethod.bulkCreate(
          branch_ids.map((branch_id) => ({
            org_id: ctx.orgId,
            branch_id,
            pos_payment_method_id: id,
            is_active: true,
            sort_order: method.sort_order,
          })),
        )
      }
    }

    return NextResponse.json({ data: method })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof UniqueConstraintError) {
      return NextResponse.json({ error: 'Ya existe un método de pago con ese tipo.', code: 'DUPLICATE_TYPE' }, { status: 409 })
    }
    throw err
  }
})

export const DELETE = withPermission('contacts:write', async (_req: NextRequest, { params }, session) => {
  const { id } = await params

  try {
    const ctx = await makeTenantContext(session.user)
    const method = await PosPaymentMethod.findOne({ where: { id, org_id: ctx.orgId } })
    if (!method) return NextResponse.json({ error: 'No encontrado', code: 'NOT_FOUND' }, { status: 404 })

    await method.destroy()
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})
