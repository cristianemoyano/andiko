import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import type { TenantContext } from '@/lib/tenancy'
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'
import Contact from '@/modules/contacts/contact.model'
import { ensurePurchasesBranchAssociations } from '@/modules/purchases/purchases-branch-associations'
import { sumTotals, type LibroIvaResult, type LibroIvaRow } from './libro-iva-ventas.service'

/**
 * Libro IVA Compras — received supplier invoices in a period, at company (CUIT)
 * level. Mirrors the ventas book shape so the UI can render both identically.
 */
export async function buildLibroIvaCompras(
  ctx: TenantContext,
  range: { from: Date; to: Date },
): Promise<LibroIvaResult> {
  ensurePurchasesBranchAssociations()

  const invoices = await SupplierInvoice.findAll({
    where: {
      org_id: ctx.orgId,
      status: { [Op.notIn]: ['draft', 'cancelled'] },
      invoice_date: { [Op.between]: [range.from, range.to] },
    },
    include: [{ model: Contact, as: 'contact', attributes: ['legal_name', 'cuit'], required: false }],
    order: [['invoice_date', 'ASC']],
  })

  const rows: LibroIvaRow[] = invoices.map((d) => {
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

  return {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    rows,
    totals: sumTotals(rows),
  }
}
