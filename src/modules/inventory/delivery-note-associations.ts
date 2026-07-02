import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import User from '@/modules/auth/user.model'
import Warehouse from './warehouse.model'
import DeliveryNote from './delivery-note.model'
import CarrierAccount from '@/modules/logistics/carrier-account.model'
import SalesOrder from '@/modules/sales/sales-order.model'

function ensureAssociation(
  alias: keyof typeof DeliveryNote.associations,
  register: () => void,
): void {
  if (!DeliveryNote.associations[alias]) register()
}

/**
 * Registers DeliveryNote ↔ related model associations idempotently.
 * Each alias is checked individually so hot reload can re-bind after the
 * model class is re-evaluated without skipping newer associations.
 */
export function ensureDeliveryNoteAssociations(): void {
  ensureAssociation('branch', () => {
    DeliveryNote.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  })
  ensureAssociation('contact', () => {
    DeliveryNote.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  })
  ensureAssociation('warehouse', () => {
    DeliveryNote.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' })
  })
  ensureAssociation('issuer', () => {
    DeliveryNote.belongsTo(User, { foreignKey: 'issued_by', as: 'issuer' })
  })
  ensureAssociation('carrierAccount', () => {
    DeliveryNote.belongsTo(CarrierAccount, { foreignKey: 'carrier_account_id', as: 'carrierAccount' })
  })
  ensureAssociation('order', () => {
    DeliveryNote.belongsTo(SalesOrder, { foreignKey: 'order_id', as: 'order' })
  })
}
