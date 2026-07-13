import 'server-only'
import type { Permission } from '@/lib/permissions'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg, whereAllowedBranches } from '@/lib/tenancy'
import type { FileOwnerType } from './file-link.model'

export type OwnerPathContext = {
  branchCode: number | null
  documentRef: string | null
}

/**
 * Per owner-type rules used to derive **inherited** file access: which module permission
 * gates the owner, and whether a specific owner record is visible within the caller's
 * tenant/branch scope.
 *
 * This is the single, one-directional extension point (storage → other modules; nothing
 * imports storage back, so no cycle). Adding a new attachable entity = one entry here.
 */
export interface OwnerResolver {
  readPermission: Permission
  writePermission: Permission
  /** True when the owner record exists and is visible to the caller (org/branch scoped). */
  exists(ownerId: string, ctx: TenantContext): Promise<boolean>
  /** Branch + human ref for structured storage paths (immutable at upload time). */
  pathContext(ownerId: string, ctx: TenantContext): Promise<OwnerPathContext>
}

async function branchCodeFromId(branchId: string | null | undefined): Promise<number | null> {
  if (!branchId) return null
  const { default: Branch } = await import('@/modules/auth/branch.model')
  const row = await Branch.findByPk(branchId, { attributes: ['branch_code'] })
  return row?.branch_code ?? null
}

function shortOwnerId(ownerId: string): string {
  return ownerId.replace(/-/g, '').slice(0, 8).toLowerCase()
}

export const OWNER_RESOLVERS: Record<FileOwnerType, OwnerResolver> = {
  invoice: {
    readPermission: 'sales:read',
    writePermission: 'sales:write',
    async exists(ownerId, ctx) {
      const { default: Invoice } = await import('@/modules/sales/invoice.model')
      const row = await Invoice.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: Invoice } = await import('@/modules/sales/invoice.model')
      const row = await Invoice.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['branch_id', 'invoice_number'],
      })
      if (!row) return { branchCode: null, documentRef: shortOwnerId(ownerId) }
      return {
        branchCode: await branchCodeFromId(row.branch_id),
        documentRef: row.invoice_number,
      }
    },
  },
  product: {
    readPermission: 'products:read',
    writePermission: 'products:write',
    async exists(ownerId, ctx) {
      const { default: Product } = await import('@/modules/catalog/product.model')
      const row = await Product.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: Product } = await import('@/modules/catalog/product.model')
      const row = await Product.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['slug'],
      })
      return {
        branchCode: null,
        documentRef: row?.slug ?? shortOwnerId(ownerId),
      }
    },
  },
  contact: {
    readPermission: 'contacts:read',
    writePermission: 'contacts:write',
    async exists(ownerId, ctx) {
      const { default: Contact } = await import('@/modules/contacts/contact.model')
      const row = await Contact.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: Contact } = await import('@/modules/contacts/contact.model')
      const row = await Contact.findOne({
        where: whereOrg(ctx, { id: ownerId }),
        attributes: ['trade_name', 'legal_name'],
      })
      const name = row?.trade_name?.trim() || row?.legal_name?.trim()
      return {
        branchCode: null,
        documentRef: name ?? shortOwnerId(ownerId),
      }
    },
  },
  supplier_invoice: {
    readPermission: 'purchases:read',
    writePermission: 'purchases:write',
    async exists(ownerId, ctx) {
      const { default: SupplierInvoice } = await import('@/modules/purchases/supplier-invoice.model')
      const row = await SupplierInvoice.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: SupplierInvoice } = await import('@/modules/purchases/supplier-invoice.model')
      const row = await SupplierInvoice.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['branch_id', 'invoice_number'],
      })
      if (!row) return { branchCode: null, documentRef: shortOwnerId(ownerId) }
      return {
        branchCode: await branchCodeFromId(row.branch_id),
        documentRef: row.invoice_number,
      }
    },
  },
  purchase_receipt: {
    readPermission: 'purchases:read',
    writePermission: 'purchases:write',
    async exists(ownerId, ctx) {
      const { default: PurchaseReceipt } = await import('@/modules/purchases/purchase-receipt.model')
      const row = await PurchaseReceipt.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: PurchaseReceipt } = await import('@/modules/purchases/purchase-receipt.model')
      const row = await PurchaseReceipt.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['branch_id', 'receipt_number'],
      })
      if (!row) return { branchCode: null, documentRef: shortOwnerId(ownerId) }
      return {
        branchCode: await branchCodeFromId(row.branch_id),
        documentRef: row.receipt_number,
      }
    },
  },
  expense: {
    readPermission: 'expenses:read',
    writePermission: 'expenses:write',
    async exists(ownerId, ctx) {
      const { default: Expense } = await import('@/modules/expenses/expense.model')
      const row = await Expense.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: Expense } = await import('@/modules/expenses/expense.model')
      const row = await Expense.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['branch_id', 'expense_number'],
      })
      if (!row) return { branchCode: null, documentRef: shortOwnerId(ownerId) }
      return {
        branchCode: await branchCodeFromId(row.branch_id),
        documentRef: row.expense_number,
      }
    },
  },
  expense_payment: {
    readPermission: 'expenses:read',
    writePermission: 'expenses:write',
    async exists(ownerId, ctx) {
      const { default: ExpensePayment } = await import('@/modules/expenses/expense-payment.model')
      const row = await ExpensePayment.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['id'],
      })
      return row !== null
    },
    async pathContext(ownerId, ctx) {
      const { default: ExpensePayment } = await import('@/modules/expenses/expense-payment.model')
      const row = await ExpensePayment.findOne({
        where: whereAllowedBranches(ctx, { id: ownerId }),
        attributes: ['branch_id', 'payment_number'],
      })
      if (!row) return { branchCode: null, documentRef: shortOwnerId(ownerId) }
      return {
        branchCode: await branchCodeFromId(row.branch_id),
        documentRef: row.payment_number,
      }
    },
  },
}
