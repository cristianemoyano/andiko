import 'server-only'
import { Op } from 'sequelize'
import Decimal from 'decimal.js'
import type { TenantContext } from '@/lib/tenancy'
import Invoice from '@/modules/sales/invoice.model'
import CreditNote from '@/modules/sales/credit-note.model'
import DebitNote from '@/modules/sales/debit-note.model'
import Contact from '@/modules/contacts/contact.model'
import { ensureSalesBranchAssociations } from '@/modules/sales/sales-branch-associations'

export type LibroIvaRow = {
  date: string | null
  kind: 'invoice' | 'credit_note' | 'debit_note'
  comprobante_tipo: number | null
  number: string
  contact_name: string | null
  cuit: string | null
  cae: string | null
  neto: string
  iva: string
  total: string
  /** Sign applied to totals: credit notes subtract from the IVA book. */
  sign: 1 | -1
}

export type LibroIvaResult = {
  from: string
  to: string
  rows: LibroIvaRow[]
  totals: { neto: string; iva: string; total: string; count: number }
}

type DocRow = {
  issue_date: Date | string | null
  comprobante_tipo: number | null
  cae: string | null
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  contact?: { legal_name: string; cuit: string | null } | null
}

/**
 * Libro IVA Ventas — authorized sales comprobantes (facturas, notas de crédito y
 * débito) in a period, at company (CUIT) level. Credit notes count negatively.
 */
export async function buildLibroIvaVentas(
  ctx: TenantContext,
  range: { from: Date; to: Date },
): Promise<LibroIvaResult> {
  ensureSalesBranchAssociations()

  const contactInclude = { model: Contact, as: 'contact', attributes: ['legal_name', 'cuit'], required: false }
  const baseWhere = (dateCol: string) => ({
    org_id: ctx.orgId,
    afip_status: 'authorized',
    [dateCol]: { [Op.between]: [range.from, range.to] },
  })

  const [invoices, creditNotes, debitNotes] = await Promise.all([
    Invoice.findAll({ where: baseWhere('issue_date'), include: [contactInclude], order: [['issue_date', 'ASC']] }),
    CreditNote.findAll({ where: baseWhere('issue_date'), include: [contactInclude], order: [['issue_date', 'ASC']] }),
    DebitNote.findAll({ where: baseWhere('issue_date'), include: [contactInclude], order: [['issue_date', 'ASC']] }),
  ])

  const rows: LibroIvaRow[] = [
    ...invoices.map((d) => toRow(d as unknown as DocRow, 'invoice', (d as unknown as { invoice_number: string }).invoice_number, 1)),
    ...creditNotes.map((d) => toRow(d as unknown as DocRow, 'credit_note', (d as unknown as { credit_note_number: string }).credit_note_number, -1)),
    ...debitNotes.map((d) => toRow(d as unknown as DocRow, 'debit_note', (d as unknown as { debit_note_number: string }).debit_note_number, 1)),
  ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  return { from: isoDate(range.from), to: isoDate(range.to), rows, totals: sumTotals(rows) }
}

function toRow(d: DocRow, kind: LibroIvaRow['kind'], number: string, sign: 1 | -1): LibroIvaRow {
  const neto = new Decimal(d.subtotal).minus(d.discount_amount).toFixed(2)
  return {
    date: d.issue_date ? isoDate(new Date(d.issue_date)) : null,
    kind,
    comprobante_tipo: d.comprobante_tipo,
    number,
    contact_name: d.contact?.legal_name ?? null,
    cuit: d.contact?.cuit ?? null,
    cae: d.cae,
    neto,
    iva: new Decimal(d.tax_amount).toFixed(2),
    total: new Decimal(d.total).toFixed(2),
    sign,
  }
}

export function sumTotals(rows: LibroIvaRow[]): LibroIvaResult['totals'] {
  let neto = new Decimal(0)
  let iva = new Decimal(0)
  let total = new Decimal(0)
  for (const r of rows) {
    neto = neto.plus(new Decimal(r.neto).mul(r.sign))
    iva = iva.plus(new Decimal(r.iva).mul(r.sign))
    total = total.plus(new Decimal(r.total).mul(r.sign))
  }
  return { neto: neto.toFixed(2), iva: iva.toFixed(2), total: total.toFixed(2), count: rows.length }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
