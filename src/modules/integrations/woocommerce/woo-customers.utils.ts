import type { WooCustomer } from './woo-client'
import type { CustomerImportPreviewItem, CustomerImportPreviewSnapshot } from './woo-import-preview.cache'

export function customerDisplayName(customer: WooCustomer): string {
  const billing = customer.billing
  const fromBilling = [billing?.first_name, billing?.last_name].filter(Boolean).join(' ').trim()
  if (fromBilling) return fromBilling
  const fromRoot = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
  if (fromRoot) return fromRoot
  if (customer.email?.trim()) return customer.email.trim()
  if (customer.username?.trim()) return customer.username.trim()
  return `Cliente WooCommerce #${customer.id}`
}

export function customerEmail(customer: WooCustomer): string | null {
  const email = customer.email?.trim() || customer.billing?.email?.trim() || null
  return email ? email.toLowerCase() : null
}

function toPreviewItem(customer: WooCustomer): CustomerImportPreviewItem {
  return {
    woo_customer_id: customer.id,
    name: customerDisplayName(customer),
    email: customerEmail(customer),
  }
}

export function classifyCustomersForPreview(
  customers: WooCustomer[],
  linkedIds: Set<string>,
  erpEmails: Set<string>,
): CustomerImportPreviewSnapshot {
  const snapshot: CustomerImportPreviewSnapshot = {
    woo_total: customers.length,
    to_import: [],
    matched_by_email: [],
    already_linked: [],
    skipped: [],
  }

  for (const customer of customers) {
    const item = toPreviewItem(customer)
    const email = customerEmail(customer)
    if (!email) {
      snapshot.skipped.push(item)
      continue
    }
    if (linkedIds.has(String(customer.id))) {
      snapshot.already_linked.push(item)
      continue
    }
    if (erpEmails.has(email)) {
      snapshot.matched_by_email.push(item)
      continue
    }
    snapshot.to_import.push(item)
  }

  return snapshot
}

/** Woo customer IDs whose ERP link points to a non-deleted contact. */
export function activeLinkedWooCustomerIds(
  links: Array<{ woo_customer_id: string | number; contact_id: string }>,
  liveContactIds: Set<string>,
): Set<string> {
  const ids = new Set<string>()
  for (const link of links) {
    if (liveContactIds.has(link.contact_id)) {
      ids.add(String(link.woo_customer_id))
    }
  }
  return ids
}
