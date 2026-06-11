import type { IvaRate, PaymentCondition } from '@/types'

/** API path segment + registry key (lowercase). */
export type PrintDomain = 'sales' | 'purchases'

export type PrintableDocumentKind =
  | 'sales_quote'
  | 'sales_order'
  | 'sales_invoice'
  | 'delivery_note'
  | 'purchase_order'
  | 'purchase_receipt'
  | 'supplier_invoice'
  | 'supplier_payment'

export type CounterpartyRole = 'customer' | 'supplier'

export interface PrintableIssuer {
  name: string
  /** Org legal name (razón social), when configured. */
  legal_name: string | null
  cuit: string | null
  iva_condition_label: string | null
  fiscal_address: string | null
}

/** Resolved print-template presentation config, merged with defaults. */
export interface PrintableTemplate {
  logo_url: string | null
  accent_color: string
  /** CSS font stack resolved from the whitelisted family. */
  font_css: string
  footer_text: string | null
  /** Section visibility toggles. */
  sections: {
    logo: boolean
    fiscal_block: boolean
    branch: boolean
    counterparty: boolean
    notes: boolean
    footer: boolean
  }
  /** Per-field fiscal display toggles. */
  show_cuit: boolean
  show_iva_condition: boolean
  show_fiscal_address: boolean
}

export interface PrintableBranch {
  id: string
  name: string
  branch_code: number
}

export interface PrintableCounterparty {
  legal_name: string
  trade_name: string | null
}

export interface PrintableLineItem {
  description: string
  quantity: string
  unit_price: string
  discount_pct: string | null
  iva_rate: IvaRate | null
  subtotal: string | null
  discount_amount: string | null
  tax_amount: string | null
  total: string | null
}

export interface PrintableTotals {
  subtotal: string
  discount_amount: string | null
  tax_amount: string
  total: string
}

export interface PrintablePaymentRow {
  payment_number: string
  payment_date: string
  amount: string
  payment_method: string
  reference: string | null
}

/** Serialized document for print / PDF preview. */
export interface PrintableDocument {
  domain: PrintDomain
  kind: PrintableDocumentKind
  isDraft: boolean
  issuer: PrintableIssuer
  /** Per-org presentation config (logo, colors, fiscal toggles, sections, footer). */
  template: PrintableTemplate
  title: string
  document_number: string
  status_code: string
  status_label: string
  currency: string
  payment_condition: PaymentCondition | null
  payment_condition_label: string | null
  counterparty_role: CounterpartyRole
  counterparty: PrintableCounterparty | null
  branch: PrintableBranch | null
  /** Extra key dates for the header (ISO strings). */
  meta_dates: Array<{ label: string; value: string | null }>
  lines: PrintableLineItem[]
  totals: PrintableTotals
  notes: string | null
  /** e.g. sales invoice — supplier payments on supplier invoice */
  payments: PrintablePaymentRow[] | null
}

export const PRINTING_ERROR_CODES = {
  NOT_FOUND: 'NOT_FOUND',
  HANDLER_NOT_FOUND: 'HANDLER_NOT_FOUND',
  ORG_CONTEXT_REQUIRED: 'ORG_CONTEXT_REQUIRED',
} as const
