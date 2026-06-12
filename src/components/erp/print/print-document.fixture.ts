import type { PrintableDocument, PrintableTemplate } from '@/types/printing'

/** Default presentation template — keeps printed output identical to pre-template behavior. */
export const defaultPrintableTemplate: PrintableTemplate = {
  logo_url: null,
  accent_color: '#18181b',
  font_css: 'ui-sans-serif, system-ui, sans-serif',
  footer_text: null,
  sections: { logo: true, fiscal_block: true, branch: true, counterparty: true, notes: true, footer: true },
  show_cuit: true,
  show_iva_condition: true,
  show_fiscal_address: true,
}

export const samplePrintableQuote: PrintableDocument = {
  domain: 'sales',
  kind: 'sales_quote',
  isDraft: true,
  issuer: {
    name: 'Andiko Demo S.A.',
    legal_name: 'Andiko Demo Sociedad Anónima',
    cuit: '30-71234567-9',
    iva_condition_label: 'Responsable Inscripto',
    fiscal_address: 'Av. San Martín 1234, Mendoza',
  },
  template: defaultPrintableTemplate,
  title: 'Presupuesto',
  document_number: 'PRES-01-0042',
  status_code: 'draft',
  status_label: 'Borrador',
  currency: 'ARS',
  payment_condition: 'net_30',
  payment_condition_label: '30 días',
  counterparty_role: 'customer',
  counterparty: { legal_name: 'Cliente Ejemplo S.R.L.', trade_name: 'Cliente Ejemplo' },
  branch: { id: 'b1', name: 'Casa Central', branch_code: 1 },
  meta_dates: [
    { label: 'Emisión', value: '24/04/2026' },
    { label: 'Válido hasta', value: '30/04/2026' },
  ],
  lines: [
    {
      description: 'Producto A',
      quantity: '2',
      unit_price: '1500.00',
      discount_pct: '0',
      iva_rate: '21',
      subtotal: '3000.00',
      discount_amount: '0.00',
      tax_amount: '630.00',
      total: '3630.00',
    },
  ],
  totals: {
    subtotal: '3000.00',
    discount_amount: '0.00',
    tax_amount: '630.00',
    total: '3630.00',
  },
  notes: 'Gracias por su compra.',
  payments: null,
}

export const samplePrintableInvoice: PrintableDocument = {
  ...samplePrintableQuote,
  kind: 'sales_invoice',
  isDraft: false,
  title: 'Factura',
  document_number: 'FAC-01-0099',
  status_code: 'issued',
  status_label: 'Emitida',
  meta_dates: [
    { label: 'Emisión', value: '24/04/2026' },
    { label: 'Fecha emisión', value: '24/04/2026' },
    { label: 'Vencimiento', value: '24/05/2026' },
  ],
  payments: [
    {
      payment_number: 'COB-01-0001',
      payment_date: '24/04/2026',
      amount: '3630.00',
      payment_method: 'Transferencia',
      reference: 'TRX-123',
    },
  ],
}
