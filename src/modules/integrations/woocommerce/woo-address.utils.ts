import type { WooAddress } from './woo-client'
import type { ContactAddressInput } from '@/modules/contacts/contact-address.schema'

export const WOO_IMPORT_SOURCE = 'woocommerce'

const COUNTRY_LABELS: Record<string, string> = {
  AR: 'Argentina',
  ar: 'Argentina',
}

export function normalizeWooCountry(code: string | undefined): string {
  if (!code?.trim()) return 'Argentina'
  const trimmed = code.trim()
  return COUNTRY_LABELS[trimmed] ?? trimmed
}

function addressFingerprint(addr: WooAddress): string {
  return [
    addr.address_1,
    addr.address_2,
    addr.city,
    addr.state,
    addr.postcode,
    addr.country,
    addr.first_name,
    addr.last_name,
    addr.company,
  ].map((v) => (v ?? '').trim().toLowerCase()).join('|')
}

export function wooAddressHasLocation(addr: WooAddress | undefined): boolean {
  return Boolean(addr?.address_1?.trim() || addr?.city?.trim())
}

export function wooAddressesEqual(a: WooAddress | undefined, b: WooAddress | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  if (!wooAddressHasLocation(a) || !wooAddressHasLocation(b)) return false
  return addressFingerprint(a) === addressFingerprint(b)
}

/** Maps a Woo billing/shipping block to a contact address row. Returns null when empty. */
export function wooAddressToContactInput(
  addr: WooAddress | undefined,
  type: ContactAddressInput['type'],
  isDefault = false,
): ContactAddressInput | null {
  const street = addr?.address_1?.trim()
  const city = addr?.city?.trim()
  const province = addr?.state?.trim()
  if (!street && !city) return null

  return {
    type,
    street: street || 'Sin calle',
    number: null,
    second_line: addr?.address_2?.trim() || null,
    floor: null,
    apartment: null,
    city: city || 'Sin ciudad',
    province: province || 'Sin provincia',
    postal_code: addr?.postcode?.trim() || null,
    country: normalizeWooCountry(addr?.country),
    is_default: isDefault,
  }
}

export function wooCustomerAddressInputs(
  billing: WooAddress | undefined,
  shipping: WooAddress | undefined,
): ContactAddressInput[] {
  const fiscal = wooAddressToContactInput(billing, 'fiscal', true)
  if (!fiscal) return []

  if (!wooAddressHasLocation(shipping) || wooAddressesEqual(billing, shipping)) {
    return [fiscal]
  }

  const delivery = wooAddressToContactInput(shipping, 'delivery', false)
  return delivery ? [fiscal, delivery] : [fiscal]
}

export function resolveWooCustomerLegalName(customer: {
  billing?: WooAddress
  shipping?: WooAddress
  first_name?: string
  last_name?: string
  email?: string
  username?: string
  id: number
}, fallbackName: string): string {
  const company = customer.billing?.company?.trim() || customer.shipping?.company?.trim()
  if (company) return company
  return fallbackName
}

export function resolveWooCustomerPhone(customer: {
  billing?: WooAddress
  shipping?: WooAddress
}): string | null {
  return customer.billing?.phone?.trim()
    || customer.shipping?.phone?.trim()
    || null
}

export function wooExternalCustomerId(wooCustomerId: number): string {
  return String(wooCustomerId)
}

export function wooExternalProductId(wooProductId: number, wooVariationId: number | null): string {
  return wooVariationId ? `${wooProductId}:${wooVariationId}` : String(wooProductId)
}

export function wooExternalOrderId(wooOrderId: number): string {
  return String(wooOrderId)
}
