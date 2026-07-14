import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import type { TenantContext } from '@/lib/tenancy'
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'
import PurchaseReturn from '@/modules/purchases/purchase-return.model'
import PurchaseOrder from '@/modules/purchases/purchase-order.model'
import Contact from '@/modules/contacts/contact.model'
import Expense from '@/modules/expenses/expense.model'
import { ensurePurchasesBranchAssociations } from '@/modules/purchases/purchases-branch-associations'
import { ensurePurchaseReturnAssociations } from '@/modules/purchases/purchase-returns.service'
import { ensureExpensesBranchAssociations } from '@/modules/expenses/expenses-branch-associations'
import { sumTotals, type LibroIvaResult, type LibroIvaRow } from './libro-iva-ventas.service'

/**
 * Libro IVA Compras — received supplier invoices in a period, at company (CUIT)
 * level. Mirrors the ventas book shape so the UI can render both identically.
 * Completed purchase returns count negatively (the supplier's credit note
 * reduces our IVA crédito fiscal).
 */
export async function buildLibroIvaCompras(
  ctx: TenantContext,
  range: { from: Date; to: Date },
): Promise<LibroIvaResult> {
  ensurePurchasesBranchAssociations()
  ensurePurchaseReturnAssociations()
  ensureExpensesBranchAssociations()

  const invoices = await SupplierInvoice.findAll({
    where: {
      org_id: ctx.orgId,
      status: { [Op.notIn]: ['draft', 'cancelled'] },
      invoice_date: { [Op.between]: [range.from, range.to] },
    },
    include: [{ model: Contact, as: 'contact', attributes: ['legal_name', 'cuit'], required: false }],
    order: [['invoice_date', 'ASC']],
  })

  const invoiceRows: LibroIvaRow[] = invoices.map((d) => {
    const doc = d as unknown as {
      invoice_date: Date | string | null
      supplier_invoice_number: string | null
      invoice_number: string
      subtotal: string
      discount_amount: string
      tax_amount: string
      total: string
      contact?: { legal_name: string; cuit: string | null } | null
    }
    return {
      date: doc.invoice_date ? new Date(doc.invoice_date).toISOString().slice(0, 10) : null,
      kind: 'invoice' as const,
      comprobante_tipo: null,
      number: doc.supplier_invoice_number ?? doc.invoice_number,
      contact_name: doc.contact?.legal_name ?? null,
      cuit: doc.contact?.cuit ?? null,
      cae: null,
      neto: new Decimal(doc.subtotal).minus(doc.discount_amount).toFixed(2),
      iva: new Decimal(doc.tax_amount).toFixed(2),
      total: new Decimal(doc.total).toFixed(2),
      sign: 1 as const,
    }
  })

  const returns = await PurchaseReturn.findAll({
    where: {
      org_id: ctx.orgId,
      status: 'completed',
      completed_at: { [Op.between]: [range.from, range.to] },
    },
    include: [
      {
        model: PurchaseOrder,
        as: 'order',
        attributes: ['id'],
        required: false,
        include: [{ model: Contact, as: 'contact', attributes: ['legal_name', 'cuit'], required: false }],
      },
    ],
    order: [['completed_at', 'ASC']],
  })

  const returnRows: LibroIvaRow[] = returns
    .filter((r) => new Decimal(r.returned_total).gt(0))
    .map((d) => {
      const doc = d as unknown as {
        completed_at: Date | string | null
        return_number: string
        returned_subtotal: string
        returned_discount: string
        returned_tax: string
        returned_total: string
        order?: { contact?: { legal_name: string; cuit: string | null } | null } | null
      }
      return {
        date: doc.completed_at ? new Date(doc.completed_at).toISOString().slice(0, 10) : null,
        kind: 'credit_note' as const,
        comprobante_tipo: null,
        number: doc.return_number,
        contact_name: doc.order?.contact?.legal_name ?? null,
        cuit: doc.order?.contact?.cuit ?? null,
        cae: null,
        neto: new Decimal(doc.returned_subtotal).minus(doc.returned_discount).toFixed(2),
        iva: new Decimal(doc.returned_tax).toFixed(2),
        total: new Decimal(doc.returned_total).toFixed(2),
        sign: -1 as const,
      }
    })

  const expenses = await Expense.findAll({
    where: {
      org_id: ctx.orgId,
      status: { [Op.notIn]: ['draft', 'cancelled'] },
      invoice_date: { [Op.between]: [range.from, range.to] },
    },
    include: [{ model: Contact, as: 'contact', attributes: ['legal_name', 'cuit'], required: false }],
    order: [['invoice_date', 'ASC']],
  })

  const expenseRows: LibroIvaRow[] = expenses.map((d) => {
    const doc = d as unknown as {
      invoice_date: Date | string | null
      invoice_number: string | null
      expense_number: string
      subtotal: string
      discount_amount: string
      tax_amount: string
      total: string
      contact?: { legal_name: string; cuit: string | null } | null
    }
    return {
      date: doc.invoice_date ? new Date(doc.invoice_date).toISOString().slice(0, 10) : null,
      kind: 'invoice' as const,
      comprobante_tipo: null,
      number: doc.invoice_number ?? doc.expense_number,
      contact_name: doc.contact?.legal_name ?? null,
      cuit: doc.contact?.cuit ?? null,
      cae: null,
      neto: new Decimal(doc.subtotal).minus(doc.discount_amount).toFixed(2),
      iva: new Decimal(doc.tax_amount).toFixed(2),
      total: new Decimal(doc.total).toFixed(2),
      sign: 1 as const,
    }
  })

  const rows = [...invoiceRows, ...returnRows, ...expenseRows].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  return {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    rows,
    totals: sumTotals(rows),
  }
}
