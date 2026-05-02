import type { PosSale, PosProduct, PosCustomer } from '@andiko/shared'

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
  }
  customers: {
    search: (query: string) => Promise<PosCustomer[]>
  }
  users: {
    search: (query: string) => Promise<{ ok: boolean; error?: string; data: Array<{ id: string; name: string; email: string; role: string; branch_id: string | null }> }>
    verifyPin: (args: { user_id: string; pin: string }) => Promise<{ ok: boolean; user?: { id: string; name: string }; error?: string }>
  }
  draftSales: {
    getActive: () => Promise<{ ok: boolean; data: null | {
      id: string
      status: string
      cashier_user_id: string | null
      cashier_name: string | null
      customer_id: string | null
      payment_method: string | null
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
      payment_method: string | null
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
      payment_method: string | null
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
    checkout: (args: { draft_sale_id: string; payment_method: PosSale['payment_method']; sold_at?: string; subtotal: string; tax_amount: string; total: string }) => Promise<{ ok: boolean; sale_id?: string; error?: string }>
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
    create: (sale: PosSale) => Promise<{ id: string }>
    listToday: () => Promise<unknown[]>
    list: (args?: { limit?: number }) => Promise<Array<{
      id: string
      customer_id: string | null
      payment_method: string
      subtotal: string
      tax_amount: string
      total: string
      sold_at: string
      cloud_id: string | null
      synced_at: string | null
    }>>
    closingReport: (date?: string) => Promise<{ cash: number; card: number; transfer: number; total: number; count: number; date: string }>
    get: (saleId: string) => Promise<null | {
      sale: {
        id: string
        customer_id: string | null
        payment_method: string
        subtotal: string
        tax_amount: string
        total: string
        sold_at: string
        cloud_id: string | null
        synced_at: string | null
      }
      items: Array<{
        id: number
        sale_id: string
        product_id: string
        product_name: string
        qty: number
        unit_price: string
        total: string
      }>
    }>
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
}

declare global {
  interface Window {
    pos: PosAPI
  }
  const __APP_VERSION__: string
}
