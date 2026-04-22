import 'server-only'
import type { ModelStatic } from 'sequelize'
import type Branch from '@/modules/auth/branch.model'
import type SalesQuote from './sales-quote.model'
import type SalesOrder from './sales-order.model'
import type Invoice from './invoice.model'

let registered = false

/** Registers Branch ↔ sales document associations (lazy, avoids loading Branch in unit tests that mock `@/lib/db`). */
export function ensureSalesBranchAssociations(): void {
  if (registered) return
  registered = true
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy init after real Sequelize is available
  const BranchModel = require('@/modules/auth/branch.model').default as ModelStatic<Branch>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SalesQuoteModel = require('./sales-quote.model').default as ModelStatic<SalesQuote>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SalesOrderModel = require('./sales-order.model').default as ModelStatic<SalesOrder>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const InvoiceModel = require('./invoice.model').default as ModelStatic<Invoice>

  SalesQuoteModel.belongsTo(BranchModel, { foreignKey: 'branch_id', as: 'branch' })
  SalesOrderModel.belongsTo(BranchModel, { foreignKey: 'branch_id', as: 'branch' })
  InvoiceModel.belongsTo(BranchModel, { foreignKey: 'branch_id', as: 'branch' })
}
