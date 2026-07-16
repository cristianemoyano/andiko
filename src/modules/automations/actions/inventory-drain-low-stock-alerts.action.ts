import 'server-only'
import { z } from 'zod'
import { registerAutomationAction } from '../action-registry'
import { drainPendingLowStockAlerts } from '@/modules/inventory/low-stock-alert.service'

const payloadSchema = z.object({})

registerAutomationAction({
  type: 'inventory.drain_low_stock_alerts',
  label: 'Enviar alertas de stock bajo pendientes',
  payloadSchema,
  async run(ctx) {
    const { sent_count } = await drainPendingLowStockAlerts(ctx.orgId)
    return {
      summary: `${sent_count} alerta(s) de stock bajo enviada(s)`,
      data: { sent_count },
    }
  },
})
