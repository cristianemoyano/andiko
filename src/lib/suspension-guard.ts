/**
 * Pure helpers for the past_due subscription gate (no server-only, trivially testable).
 *
 * UI: the `(erp)` layout redirects suspended orgs to `/suspendido`, except on the
 * paths exempted here (`/facturacion` stays open so a Gerente can view invoices and pay).
 * API: mutating requests are blocked with 403 `SUBSCRIPTION_SUSPENDED`; reads stay open.
 */

export const SUSPENDIDO_PATH = '/suspendido' as const

const SUSPENSION_EXEMPT_PREFIXES: readonly string[] = [SUSPENDIDO_PATH, '/facturacion']

/** True for `/suspendido` and `/facturacion` (and their subpaths) — never redirect these. */
export function isSuspensionExemptPath(pathname: string): boolean {
  return SUSPENSION_EXEMPT_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

const SUSPENSION_SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS']

/** True for anything other than GET/HEAD/OPTIONS (case-insensitive) — reads stay open. */
export function shouldBlockSuspendedApiRequest(method: string): boolean {
  return !SUSPENSION_SAFE_METHODS.includes(method.toUpperCase())
}
