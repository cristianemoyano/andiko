import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import User from '@/modules/auth/user.model'
import Warehouse from './warehouse.model'
import DeliveryNote from './delivery-note.model'

let registered = false

/**
 * Registers Branch / Contact / Warehouse / User ↔ delivery note associations.
 * Guarded by a flag so Sequelize does not emit "already associated" warnings
 * on hot-module reloads in dev, while ensuring a single registration per process.
 */
export function ensureDeliveryNoteAssociations(): void {
  if (registered) return
  registered = true
  DeliveryNote.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  DeliveryNote.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  DeliveryNote.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' })
  DeliveryNote.belongsTo(User, { foreignKey: 'issued_by', as: 'issuer' })
}
