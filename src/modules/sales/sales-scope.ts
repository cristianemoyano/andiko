import 'server-only'

import { Op, type WhereOptions } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'
import { whereAllowedBranches } from '@/lib/tenancy'
import { combineListWhere } from '@/modules/integrations/woocommerce/woo-list-filters'

export type SalesOwnScopeDoc = {
  salesperson_id?: string | null
  created_by?: string | null
}

/** True when the document is visible under sales:scope_own (or scope is off). */
export function isWithinSalesOwnScope(ctx: TenantContext, doc: SalesOwnScopeDoc): boolean {
  if (!ctx.salesScopeOwn || !ctx.userId) return true
  if (doc.salesperson_id) return doc.salesperson_id === ctx.userId
  return doc.created_by === ctx.userId
}

/** Throws NOT_FOUND when the document is outside own-sales scope. */
export function assertSalesOwnScope(ctx: TenantContext, doc: SalesOwnScopeDoc): void {
  if (!isWithinSalesOwnScope(ctx, doc)) {
    throw new Error('NOT_FOUND')
  }
}

/** Sequelize where fragment for documents with salesperson_id (quotes, orders, invoices, payments). */
export function whereSalesOwnScope(ctx: TenantContext): WhereOptions {
  if (!ctx.salesScopeOwn || !ctx.userId) return {}
  return {
    [Op.or]: [
      { salesperson_id: ctx.userId },
      { salesperson_id: null, created_by: ctx.userId },
    ],
  }
}

export function whereSalesDocumentScope(
  ctx: TenantContext,
  extra: Record<string, unknown> = {},
): WhereOptions {
  return combineListWhere(whereAllowedBranches(ctx, extra), whereSalesOwnScope(ctx))
}

/** Credit/debit notes: scope via linked invoice or created_by when standalone. */
export function whereSalesOwnScopeViaInvoice(ctx: TenantContext): WhereOptions {
  if (!ctx.salesScopeOwn || !ctx.userId) return {}
  return {
    [Op.or]: [
      { invoice_id: null, created_by: ctx.userId },
      { '$invoice.salesperson_id$': ctx.userId },
      {
        invoice_id: { [Op.ne]: null },
        '$invoice.salesperson_id$': null,
        '$invoice.created_by$': ctx.userId,
      },
    ],
  }
}

export function whereSalesDocumentScopeViaInvoice(
  ctx: TenantContext,
  extra: Record<string, unknown> = {},
): WhereOptions {
  return combineListWhere(whereAllowedBranches(ctx, extra), whereSalesOwnScopeViaInvoice(ctx))
}

/** Sales returns: scope via linked order or created_by. */
export function whereSalesOwnScopeViaOrder(ctx: TenantContext): WhereOptions {
  if (!ctx.salesScopeOwn || !ctx.userId) return {}
  return {
    [Op.or]: [
      { created_by: ctx.userId },
      { '$order.salesperson_id$': ctx.userId },
      {
        '$order.salesperson_id$': null,
        '$order.created_by$': ctx.userId,
      },
    ],
  }
}

export function whereSalesDocumentScopeViaOrder(
  ctx: TenantContext,
  extra: Record<string, unknown> = {},
): WhereOptions {
  return combineListWhere(whereAllowedBranches(ctx, extra), whereSalesOwnScopeViaOrder(ctx))
}
