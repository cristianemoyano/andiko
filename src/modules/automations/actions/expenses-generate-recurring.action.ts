import 'server-only'
import { z } from 'zod'
import { registerAutomationAction } from '../action-registry'
import sequelize from '@/lib/db'
import {
  findDueExpenseSchedules,
  generateExpenseFromSchedule,
} from '@/modules/expenses/expense-schedules.service'

const payloadSchema = z.object({})

registerAutomationAction({
  type: 'expenses.generate_recurring_expense',
  label: 'Generar gastos recurrentes',
  payloadSchema,
  async run(ctx) {
    const schedules = await findDueExpenseSchedules(ctx.orgId, ctx.branchId, new Date())

    let generated = 0
    let failed = 0
    for (const schedule of schedules) {
      try {
        await sequelize.transaction((t) => generateExpenseFromSchedule(schedule, ctx.orgId, t))
        generated += 1
      } catch {
        failed += 1
      }
    }

    return {
      summary: `${generated} gasto(s) recurrente(s) generado(s)${failed > 0 ? `, ${failed} fallido(s)` : ''}`,
      data: { generated, failed, examined: schedules.length },
    }
  },
})
