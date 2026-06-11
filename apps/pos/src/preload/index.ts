import { contextBridge, ipcRenderer } from 'electron'
import type { PosSale, PosSalePayment } from '@andiko/shared'

contextBridge.exposeInMainWorld('pos', {
  products: {
    search: (query: string) => ipcRenderer.invoke('products:search', query),
  },
  customers: {
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
  },
  users: {
    search: (query: string) => ipcRenderer.invoke('users:search', query),
    verifyPin: (args: { user_id: string; pin: string }) => ipcRenderer.invoke('users:verifyPin', args),
  },
  draftSales: {
    getActive: () => ipcRenderer.invoke('draftSales:getActive'),
    list: (args?: { status?: string; limit?: number }) => ipcRenderer.invoke('draftSales:list', args),
    get: (draftSaleId: string) => ipcRenderer.invoke('draftSales:get', draftSaleId),
    createOrResume: (args?: { draft_sale_id?: string; cashier_user_id?: string | null; cashier_name?: string | null; customer_id?: string | null }) =>
      ipcRenderer.invoke('draftSales:createOrResume', args),
    update: (args: { draft_sale_id: string; cashier_user_id?: string | null; cashier_name?: string | null; customer_id?: string | null; subtotal?: string; tax_amount?: string; total?: string }) =>
      ipcRenderer.invoke('draftSales:update', args),
    checkout: (args: { draft_sale_id: string; payments: PosSalePayment[]; sold_at?: string; subtotal: string; tax_amount: string; total: string }) =>
      ipcRenderer.invoke('draftSales:checkout', args),
    cancel: (draftSaleId: string) => ipcRenderer.invoke('draftSales:cancel', draftSaleId),
  },
  draftSaleItems: {
    upsert: (args: { draft_sale_id: string; product_id: string; product_name: string; qty: number; unit_price: string; total: string; iva_rate?: string; sort_order?: number }) =>
      ipcRenderer.invoke('draftSaleItems:upsert', args),
    remove: (args: { draft_sale_id: string; product_id: string }) =>
      ipcRenderer.invoke('draftSaleItems:remove', args),
  },
  cashSessions: {
    getCurrent: () => ipcRenderer.invoke('cashSessions:getCurrent'),
    open: (args: { cashier_user_id?: string | null; cashier_name?: string | null; opening_amount: string }) =>
      ipcRenderer.invoke('cashSessions:open', args),
    close: (args: { session_id: string; closing_amount_declared: string }) =>
      ipcRenderer.invoke('cashSessions:close', args),
    list: (args?: { limit?: number }) => ipcRenderer.invoke('cashSessions:list', args),
    get: (sessionId: string) => ipcRenderer.invoke('cashSessions:get', sessionId),
  },
  sales: {
    create: (sale: PosSale) => ipcRenderer.invoke('sales:create', sale),
    listToday: () => ipcRenderer.invoke('sales:list-today'),
    list: (args?: { limit?: number }) => ipcRenderer.invoke('sales:list', args),
    get: (saleId: string) => ipcRenderer.invoke('sales:get', saleId),
    closingReport: (date?: string) => ipcRenderer.invoke('sales:closingReport', date),
  },
  paymentMethods: {
    list: () => ipcRenderer.invoke('paymentMethods:list'),
  },
  sync: {
    checkLicense: () => ipcRenderer.invoke('license:check'),
    license: () => ipcRenderer.invoke('sync:license'),
    catalog: () => ipcRenderer.invoke('sync:catalog'),
    sales: () => ipcRenderer.invoke('sync:sales'),
  },
  settings: {
    save: (kv: Record<string, string>) => ipcRenderer.invoke('settings:save', kv),
    get: () => ipcRenderer.invoke('settings:get'),
  },
  dev: {
    resetLocalData: () => ipcRenderer.invoke('dev:resetLocalData'),
  },
})
