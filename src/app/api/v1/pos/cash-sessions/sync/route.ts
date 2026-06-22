import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withPosDevice } from '@/lib/pos-auth'
import User from '@/modules/auth/user.model'
import PosCashSession from '@/modules/pos/pos-cash-session.model'

const sessionSchema = z.object({
  local_id:                 z.string().min(1).max(64),
  cashier_user_id:          z.string().uuid().optional(),
  cashier_name:             z.string().max(128).optional(),
  opened_at:                z.string().datetime({ offset: true }),
  closed_at:                z.string().datetime({ offset: true }).optional(),
  opening_amount:           z.string().regex(/^\d+(\.\d{1,2})?$/),
  closing_amount_declared:  z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  closing_amount_expected:  z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  difference:               z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional(),
  status:                   z.enum(['open', 'closed']),
})

const bodySchema = z.object({
  sessions: z.array(sessionSchema).min(1).max(50),
})

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const results: Array<{ local_id: string; cloud_id: string | null; error: string | null }> = []

  for (const s of parsed.data.sessions) {
    try {
      let verifiedCashierId: string | null = null
      if (s.cashier_user_id) {
        const cashier = await User.findOne({ where: { id: s.cashier_user_id, org_id: ctx.orgId }, attributes: ['id'] })
        verifiedCashierId = cashier?.id ?? null
      }

      const [record, created] = await PosCashSession.findOrCreate({
        where: { org_id: ctx.orgId, local_id: s.local_id },
        defaults: {
          org_id:                  ctx.orgId,
          branch_id:               ctx.branchId ?? null,
          pos_device_id:           ctx.deviceRowId ?? null,
          local_id:                s.local_id,
          cashier_user_id:         verifiedCashierId,
          cashier_name:            s.cashier_name ?? null,
          opened_at:               new Date(s.opened_at),
          closed_at:               s.closed_at ? new Date(s.closed_at) : null,
          opening_amount:          s.opening_amount,
          closing_amount_declared: s.closing_amount_declared ?? null,
          closing_amount_expected: s.closing_amount_expected ?? null,
          difference:              s.difference ?? null,
          status:                  s.status,
        },
      })

      if (!created) {
        const alreadyClosed = record.status === 'closed'
        const incomingClose = s.status === 'closed'

        // Never downgrade closed → open (stale POS sync after open was pushed but close was not)
        const updates: Parameters<typeof record.update>[0] = {
          synced_at: new Date(),
        }
        if (incomingClose || !alreadyClosed) {
          updates.status = s.status
        }
        if (incomingClose) {
          updates.closed_at = s.closed_at ? new Date(s.closed_at) : record.closed_at
          updates.closing_amount_declared = s.closing_amount_declared ?? record.closing_amount_declared
          updates.closing_amount_expected = s.closing_amount_expected ?? record.closing_amount_expected
          updates.difference = s.difference ?? record.difference
        }

        await record.update(updates)
      }

      results.push({ local_id: s.local_id, cloud_id: record.id, error: null })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.push({ local_id: s.local_id, cloud_id: null, error: msg })
    }
  }

  const failed = results.filter(r => r.error !== null).length
  return NextResponse.json({ results, synced: results.length - failed, failed })
})
