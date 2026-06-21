/**
 * Maps legacy /erp/* paths used in Gherkin to real App Router URLs.
 * Route groups like (erp) are not part of the public path.
 */
const ERP_ROUTE_ALIASES: Record<string, string> = {
  '/erp': '/panel',
  '/erp/sales': '/ventas',
  '/erp/sales/invoices': '/ventas/facturas',
  '/erp/sales/receivables': '/ventas/cuenta-corriente',
  '/erp/contacts': '/contactos',
  '/erp/catalog/products': '/catalogo/productos',
  '/erp/catalog/price-lists': '/catalogo/listas-de-precios',
  '/erp/purchases': '/compras',
  '/erp/purchases/orders': '/compras/ordenes',
  '/erp/inventory': '/inventario',
  '/erp/inventory/stock': '/inventario/stock',
  '/erp/accounting': '/contabilidad',
  '/erp/accounting/journal': '/contabilidad/asientos',
  '/erp/accounting/balance': '/contabilidad/balance',
}

export function resolveAppPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return ERP_ROUTE_ALIASES[normalized] ?? normalized
}

export function isAuthenticatedAppPath(pathname: string): boolean {
  return pathname === '/panel'
    || pathname.startsWith('/ventas')
    || pathname.startsWith('/compras')
    || pathname.startsWith('/contactos')
    || pathname.startsWith('/catalogo')
    || pathname.startsWith('/inventario')
    || pathname.startsWith('/contabilidad')
    || pathname.startsWith('/configuracion')
    || pathname.startsWith('/perfil')
    || pathname.startsWith('/pos')
    || pathname.startsWith('/onboarding')
    || pathname.startsWith('/sys-admin')
}
