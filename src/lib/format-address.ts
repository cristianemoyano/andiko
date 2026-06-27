/** Structured postal address parts shared across branches, contacts and orders. */
export interface AddressParts {
  street?: string | null
  number?: string | null
  floor?: string | null
  apartment?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
}

const clean = (s: string | null | undefined): string => (s ?? '').trim()

/**
 * Compose a one-line human-readable address from structured parts. Empty parts
 * are skipped; returns '' when nothing is set. `Argentina` is omitted as the
 * implicit default country.
 */
export function formatAddress(a: AddressParts): string {
  const streetLine = [clean(a.street), clean(a.number)].filter(Boolean).join(' ')
  const unit = [
    clean(a.floor) ? `Piso ${clean(a.floor)}` : '',
    clean(a.apartment) ? `Dpto ${clean(a.apartment)}` : '',
  ].filter(Boolean).join(' ')
  const cityLine = [clean(a.city), clean(a.province)].filter(Boolean).join(', ')
  const cp = clean(a.postal_code) ? `(${clean(a.postal_code)})` : ''
  const country = clean(a.country) && clean(a.country) !== 'Argentina' ? clean(a.country) : ''

  return [
    [streetLine, unit].filter(Boolean).join(' - '),
    [cityLine, cp].filter(Boolean).join(' '),
    country,
  ].filter(Boolean).join(', ')
}
