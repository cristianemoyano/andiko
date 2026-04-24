import 'server-only'
import type { Permission } from '@/lib/permissions'
import type { PrintableDocument } from '@/types/printing'
import type { TenantContext } from '@/lib/tenancy'
import {
  buildSalesInvoicePrintable,
  buildSalesOrderPrintable,
  buildSalesQuotePrintable,
} from './sales-adapter'
import {
  buildPurchaseOrderPrintable,
  buildPurchaseReceiptPrintable,
  buildSupplierInvoicePrintable,
  buildSupplierPaymentPrintable,
} from './purchases-adapter'

export type RegisteredPrintHandler = {
  permission: Permission
  build: (id: string, ctx: TenantContext) => Promise<PrintableDocument>
}

const handlers: Record<string, RegisteredPrintHandler> = {
  'sales:quotes':   { permission: 'sales:read',     build: buildSalesQuotePrintable },
  'sales:orders':   { permission: 'sales:read',     build: buildSalesOrderPrintable },
  'sales:invoices': { permission: 'sales:read',     build: buildSalesInvoicePrintable },
  'purchases:orders':   { permission: 'purchases:read', build: buildPurchaseOrderPrintable },
  'purchases:receipts': { permission: 'purchases:read', build: buildPurchaseReceiptPrintable },
  'purchases:invoices': { permission: 'purchases:read', build: buildSupplierInvoicePrintable },
  'purchases:payments': { permission: 'purchases:read', build: buildSupplierPaymentPrintable },
}

export function getPrintHandler(domain: string, resource: string): RegisteredPrintHandler | undefined {
  const key = `${domain.toLowerCase()}:${resource.toLowerCase()}`
  return handlers[key]
}

export async function resolvePrintableDocument(
  domain: string,
  resource: string,
  id: string,
  ctx: TenantContext,
): Promise<PrintableDocument> {
  const h = getPrintHandler(domain, resource)
  if (!h) {
    throw new Error('HANDLER_NOT_FOUND')
  }
  return h.build(id, ctx)
}
