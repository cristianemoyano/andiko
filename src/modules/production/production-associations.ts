import 'server-only'
import Branch from '@/modules/auth/branch.model'
import ProductionOrder from './production-order.model'

let registered = false

export function ensureProductionAssociations(): void {
  if (registered) return
  registered = true

  ProductionOrder.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
}
