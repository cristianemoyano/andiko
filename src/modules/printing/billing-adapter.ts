import 'server-only'
import Organization from '@/modules/auth/organization.model'
import { getBillingInvoice } from '@/modules/billing/billing-invoices.service'
import { getResolvedBillerSettings } from '@/modules/billing/platform-billing-settings.service'
import type BillingInvoice from '@/modules/billing/billing-invoice.model'
import type BillingInvoiceItem from '@/modules/billing/billing-invoice-item.model'
import type BillingPayment from '@/modules/billing/billing-payment.model'
import type { PrintableDocument, PrintableLineItem, PrintablePaymentRow, PrintableTemplate } from '@/types/printing'
import { DEFAULT_PRINT_TEMPLATE, FONT_FAMILY_CSS } from './print-template.schema'
import { ORG_IVA_CONDITION_LABEL } from './print-template.service'
import { decString, formatDateArg } from './format-utils'
import { BILLING_INVOICE_STATUS_LABEL, labelBillingPaymentMethod } from './labels'

type BillingInvoiceLoaded = BillingInvoice & {
  items?: BillingInvoiceItem[]
  payments?: BillingPayment[]
}

function defaultBillingTemplate(): PrintableTemplate {
  const t = DEFAULT_PRINT_TEMPLATE
  return {
    logo_url: t.logo_url,
    accent_color: t.accent_color,
    font_css: FONT_FAMILY_CSS[t.font_family],
    footer_text: t.footer_text,
    sections: { ...t.sections, branch: false },
    show_cuit: t.show_cuit,
    show_iva_condition: t.show_iva_condition,
    show_fiscal_address: t.show_fiscal_address,
  }
}

function ivaConditionLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return ORG_IVA_CONDITION_LABEL[code as keyof typeof ORG_IVA_CONDITION_LABEL] ?? code
}

function linesFromItems(items: BillingInvoiceItem[]): PrintableLineItem[] {
  return items.map(item => ({
    description: item.description,
    quantity: decString(item.quantity),
    unit_price: decString(item.unit_price),
    discount_pct: null,
    iva_rate: item.iva_rate,
    subtotal: decString(item.subtotal),
    discount_amount: null,
    tax_amount: decString(item.tax_amount),
    total: decString(item.total),
  }))
}

export async function buildBillingInvoicePrintable(id: string): Promise<PrintableDocument> {
  const invoice = (await getBillingInvoice(id)) as unknown as BillingInvoiceLoaded
  if (!invoice) throw new Error('BILLING_INVOICE_NOT_FOUND')

  const org = invoice.org_id
    ? await Organization.findByPk(invoice.org_id, { attributes: ['name', 'legal_name'] })
    : null

  let issuerLegal = invoice.issuer_legal_name
  let issuerCuit = invoice.issuer_cuit
  let issuerIva = invoice.issuer_iva_condition
  let issuerAddress = invoice.issuer_fiscal_address

  if (!issuerLegal) {
    const platform = await getResolvedBillerSettings()
    if (platform) {
      issuerLegal = platform.legal_name
      issuerCuit = platform.cuit
      issuerIva = platform.iva_condition
      issuerAddress = platform.fiscal_address
    }
  }

  const items = invoice.items ?? []
  const payments: PrintablePaymentRow[] | null = (() => {
    const raw = invoice.payments
    if (!raw?.length) return null
    return raw.map(p => ({
      payment_number: p.payment_number,
      payment_date: formatDateArg(p.payment_date) ?? '',
      amount: decString(p.amount),
      payment_method: labelBillingPaymentMethod(p.payment_method),
      reference: p.reference,
    }))
  })()

  const periodLabel =
    invoice.period_start && invoice.period_end
      ? `${formatDateArg(invoice.period_start)} – ${formatDateArg(invoice.period_end)}`
      : null

  return {
    domain: 'billing',
    kind: 'billing_invoice',
    isDraft: invoice.status === 'draft',
    issuer: {
      name: issuerLegal ?? 'Andiko',
      legal_name: issuerLegal,
      cuit: issuerCuit,
      iva_condition_label: ivaConditionLabel(issuerIva),
      fiscal_address: issuerAddress,
    },
    template: defaultBillingTemplate(),
    title: 'Factura de suscripción',
    document_number: invoice.invoice_number,
    status_code: invoice.status,
    status_label: BILLING_INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status,
    currency: invoice.currency,
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'customer',
    counterparty: org
      ? {
          legal_name: org.legal_name ?? org.name,
          trade_name: org.legal_name && org.legal_name !== org.name ? org.name : null,
        }
      : null,
    branch: null,
    meta_dates: [
      { label: 'Emisión', value: formatDateArg(invoice.issue_date) },
      { label: 'Vencimiento', value: formatDateArg(invoice.due_date) },
      { label: 'Período', value: periodLabel },
    ],
    lines: linesFromItems(items),
    totals: {
      subtotal: decString(invoice.subtotal),
      discount_amount: null,
      tax_amount: decString(invoice.tax_amount),
      total: decString(invoice.total),
    },
    notes: invoice.notes ?? null,
    payments,
    afip: null,
  }
}
