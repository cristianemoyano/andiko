import 'server-only'
import { z } from 'zod'
import { registerAutomationAction } from '../action-registry'
import { expireOverdueQuotes } from '@/modules/sales/sales-quote-expiration.service'

const payloadSchema = z.object({})

registerAutomationAction({
  type: 'sales.expire_overdue_quotes',
  label: 'Vencer cotizaciones atrasadas',
  payloadSchema,
  async run(ctx) {
    const { expired_count } = await expireOverdueQuotes(ctx.orgId)
    return {
      summary: `${expired_count} cotización(es) marcadas como vencidas`,
      data: { expired_count },
    }
  },
})
