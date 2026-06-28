/** Woo order IDs whose link points to a live (non-deleted) sales order. */
export function activeImportedWooOrderIds(
  links: Array<{ woo_order_id: string | number; sales_order_id: string | null }>,
  liveSalesOrderIds: Set<string>,
): Set<string> {
  const ids = new Set<string>()
  for (const link of links) {
    if (link.sales_order_id && liveSalesOrderIds.has(link.sales_order_id)) {
      ids.add(String(link.woo_order_id))
    }
  }
  return ids
}
