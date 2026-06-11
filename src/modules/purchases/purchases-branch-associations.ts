import 'server-only'
import Branch from '@/modules/auth/branch.model'
import Contact from '@/modules/contacts/contact.model'
import Warehouse from '@/modules/inventory/warehouse.model'
import PurchaseOrder from './purchase-order.model'
import PurchaseReceipt from './purchase-receipt.model'
import SupplierInvoice from './supplier-invoice.model'
import SupplierPayment from './supplier-payment.model'

let registered = false

export function ensurePurchasesBranchAssociations(): void {
  if (registered) return
  registered = true

  PurchaseOrder.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  PurchaseReceipt.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  SupplierInvoice.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  SupplierPayment.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })

  PurchaseOrder.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  PurchaseReceipt.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  SupplierInvoice.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })
  SupplierPayment.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' })

  PurchaseReceipt.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' })
}
