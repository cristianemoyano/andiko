import { NextResponse } from 'next/server'
import { z } from 'zod'
import { UniqueConstraintError } from 'sequelize'
import { withPermission } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { PosPaymentMethod, PosBranchPaymentMethod, POS_PAYMENT_METHOD_TYPES } from '@/modules/pos/pos-payment-method.model'

const createSchema = z.object({
  name: z.string().min(1).max(128),
  type: z.enum([...POS_PAYMENT_METHOD_TYPES]),
  requires_reference: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).default({}),
  sort_order: z.number().int().min(0).default(0),
  branch_ids: z.array(z.string().uuid()).default([]),
})

export const GET = withPermission('contacts:read', async (_req, _ctx, session) => {
  try {
    const ctx = await makeTenantContext(session.user)

    const methods = await PosPaymentMethod.findAll({
      where: { org_id: ctx.orgId },
      include: [
        {
          model: PosBranchPaymentMethod,
          as: 'branchAssignments',
          required: false,
          paranoid: false,
          attributes: ['branch_id', 'is_active', 'sort_order'],
        },
      ],
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    })

    return NextResponse.json({ data: methods, count: methods.length })
  } catch (err) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    throw err
  }
})

export const POST = withPermission('contacts:write', async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const ctx = await makeTenantContext(session.user)
    const { branch_ids, ...methodData } = parsed.data

    const method = await PosPaymentMethod.create({ ...methodData, org_id: ctx.orgId })

    if (branch_ids.length > 0) {
      await PosBranchPaymentMethod.bulkCreate(
        branch_ids.map((branch_id) => ({
          org_id: ctx.orgId,
          branch_id,
          pos_payment_method_id: method.id,
          is_active: true,
          sort_order: method.sort_order,
        })),
      )
    }

    return NextResponse.json({ data: method }, { status: 201 })
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
