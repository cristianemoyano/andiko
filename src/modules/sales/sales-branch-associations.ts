import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import SalesQuote from './sales-quote.model'
import SalesOrder from './sales-order.model'
import Invoice from './invoice.model'

let registered = false

/**
 * Registers Branch ↔ sales document associations.
 * Uses a flag so Sequelize doesn't log "already associated" warnings on
 * hot-module reloads in dev, while ensuring a single registration per process.
 */
export function ensureSalesBranchAssociations(): void {
  if (registered) return
  registered = true
  SalesQuote.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  SalesOrder.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  Invoice.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  SalesQuote.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  SalesOrder.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  Invoice.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
}
