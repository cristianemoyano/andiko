import type { PosSale, PosProduct, PosCustomer, PosSalePayment, PosPaymentMethod } from '@andiko/shared'

interface CashSession {
  id: string
  cashier_user_id: string | null
  cashier_name: string | null
  opened_at: string
  closed_at: string | null
  opening_amount: string
  closing_amount_declared: string | null
  closing_amount_expected: string | null
  difference: string | null
  status: 'open' | 'closed'
  cloud_id: string | null
  synced_at: string | null
}

interface PosAPI {
  products: {
    search: (query: string) => Promise<PosProduct[]>
    getByPlu: (plu: string) => Promise<PosProduct | null>
  }
  customers: {
    search: (query: string) => Promise<PosCustomer[]>
    get: (id: string) => Promise<PosCustomer | null>
  }
  users: {
    search: (query: string) => Promise<{ ok: boolean; error?: string; data: Array<{ id: string; name: string; email: string; role: string; role_label: string; branch_id: string | null }> }>
    verifyPin: (args: { user_id: string; pin: string }) => Promise<{ ok: boolean; user?: { id: string; name: string }; error?: string }>
  }
  draftSales: {
    getActive: () => Promise<{ ok: boolean; data: null | {
      id: string
      status: string
      cashier_user_id: string | null
      cashier_name: string | null
      customer_id: string | null
      payments: string | null
      subtotal: string
      tax_amount: string
      total: string
      last_opened_at: string | null
      created_at: string
      updated_at: string
    } }>
    list: (args?: { status?: string; limit?: number }) => Promise<{ ok: boolean; data: Array<{
      id: string
      status: string
      cashier_user_id: string | null
      cashier_name: string | null
      customer_id: string | null
      payments: string | null
      subtotal: string
      tax_amount: string
      total: string
      last_opened_at: string | null
      created_at: string
      updated_at: string
    }> }>
    get: (draftSaleId: string) => Promise<{ ok: boolean; data: null | { sale: {
      id: string
      status: string
      cashier_user_id: string | null
      cashier_name: string | null
      customer_id: string | null
      payments: string | null
      subtotal: string
      tax_amount: string
      total: string
      last_opened_at: string | null
      created_at: string
      updated_at: string
    }; items: Array<{
      id: number
      draft_sale_id: string
      product_id: string
      product_name: string
      qty: number
      iva_rate: string
      unit_price: string
      total: string
      sort_order: number
    }> } }>
    createOrResume: (args?: { draft_sale_id?: string; cashier_user_id?: string | null; cashier_name?: string | null; customer_id?: string | null }) => Promise<{ ok: boolean; id: string }>
    update: (args: { draft_sale_id: string; cashier_user_id?: string | null; cashier_name?: string | null; customer_id?: string | null; subtotal?: string; tax_amount?: string; total?: string }) => Promise<{ ok: boolean }>
    checkout: (args: { draft_sale_id: string; payments: PosSalePayment[]; sold_at?: string; subtotal: string; tax_amount: string; total: string; cashier_user_id?: string | null; cashier_name?: string | null }) => Promise<{
      ok: boolean
      sale_id?: string
      ticket_number?: string
      cloud_id?: string
      cae?: string | null
      cae_expiration?: string | null
      qr_url?: string | null
      afip_status?: string
      fiscal_pending?: boolean
      afip_error?: string | null
      error?: string
    }>
    cancel: (draftSaleId: string) => Promise<{ ok: boolean }>
  }
  draftSaleItems: {
    upsert: (args: { draft_sale_id: string; product_id: string; product_name: string; qty: number; unit_price: string; total: string; iva_rate?: string; sort_order?: number }) => Promise<{ ok: boolean }>
    remove: (args: { draft_sale_id: string; product_id: string }) => Promise<{ ok: boolean }>
  }
  cashSessions: {
    getCurrent: () => Promise<CashSession | null>
    open: (args: { cashier_user_id?: string | null; cashier_name?: string | null; opening_amount: string }) => Promise<{ ok: boolean; session?: CashSession; error?: string }>
    close: (args: { session_id: string; closing_amount_declared: string }) => Promise<{ ok: boolean; session?: CashSession; error?: string }>
    list: (args?: { limit?: number }) => Promise<CashSession[]>
    get: (sessionId: string) => Promise<CashSession | null>
  }
  sales: {
    create: (sale: PosSale) => Promise<{
      id: string
      ticket_number: string | null
      cloud_id?: string | null
      cae?: string | null
      cae_expiration?: string | null
      qr_url?: string | null
      afip_status?: string | null
      fiscal_pending?: boolean
      afip_error?: string | null
    }>
    authorizeFiscal: (saleId: string) => Promise<{
      ok: true
      sale_id: string
      ticket_number: string | null
      cloud_id: string | null
      cae: string | null
      cae_expiration: string | null
      qr_url: string | null
      afip_status: string
      fiscal_pending: boolean
    }>
    listToday: () => Promise<unknown[]>
    list: (args?: { limit?: number }) => Promise<Array<{
      id: string
      ticket_number: string | null
      customer_id: string | null
      payments: string
      subtotal: string
      tax_amount: string
      total: string
      sold_at: string
      cloud_id: string | null
      synced_at: string | null
      cae: string | null
      afip_status: string | null
    }>>
    closingReport: (date?: string) => Promise<{ cash: number; card: number; transfer: number; total: number; count: number; date: string }>
    get: (saleId: string) => Promise<null | {
      sale: {
        id: string
        ticket_number: string | null
        customer_id: string | null
        cashier_name: string | null
        payments: string
        subtotal: string
        tax_amount: string
        total: string
        sold_at: string
        cloud_id: string | null
        synced_at: string | null
        cae: string | null
        cae_expiration: string | null
        qr_url: string | null
        afip_status: string | null
      }
      items: Array<{
        id: number
        sale_id: string
        product_id: string
        product_name: string
        qty: number
        iva_rate: string
        unit_price: string
        total: string
      }>
      customer: PosCustomer | null
    }>
  }
  paymentMethods: {
    list: () => Promise<PosPaymentMethod[]>
  }
  sync: {
    checkLicense: () => Promise<unknown>
    catalog: () => Promise<{ ok: boolean; error?: string }>
    sales: () => Promise<{ ok: boolean; error?: string }>
  }
  settings: {
    save: (kv: Record<string, string>) => Promise<{ ok: boolean }>
    get: () => Promise<Record<string, string>>
  }
  scale: {
    listPorts: () => Promise<{ ok: boolean; ports: Array<{ path: string; manufacturer?: string }>; error?: string }>
    readWeight: () => Promise<{ ok: boolean; weightKg?: number; error?: string }>
    status: () => Promise<{ enabled: boolean; port: string; available: boolean }>
  }
  dev: {
    resetLocalData: () => Promise<{ ok: boolean; error?: string }>
  }
  print: {
    receipt: () => Promise<{ ok: boolean; error?: string }>
  }
}

declare global {
  interface Window {
    pos: PosAPI
  }
  const __APP_VERSION__: string
}
