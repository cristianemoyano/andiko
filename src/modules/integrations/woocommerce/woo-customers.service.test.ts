import { describe, expect, it } from 'vitest'
import {
  activeLinkedWooCustomerIds,
  classifyCustomersForPreview,
  customerDisplayName,
  customerEmail,
} from './woo-customers.utils'
import type { WooCustomer } from './woo-client'

describe('customerDisplayName', () => {
  it('prefers billing name', () => {
    expect(customerDisplayName({
      id: 1,
      billing: { first_name: 'Ana', last_name: 'García' },
    })).toBe('Ana García')
  })

  it('falls back to email', () => {
    expect(customerDisplayName({ id: 2, email: 'buyer@example.com' })).toBe('buyer@example.com')
  })
})

describe('customerEmail', () => {
  it('normalizes email to lowercase', () => {
    expect(customerEmail({ id: 1, email: 'Buyer@Example.com' })).toBe('buyer@example.com')
  })

  it('uses billing email when root email is missing', () => {
    expect(customerEmail({ id: 1, billing: { email: 'bill@example.com' } })).toBe('bill@example.com')
  })

  it('returns null when no email', () => {
    expect(customerEmail({ id: 1, first_name: 'Guest' })).toBeNull()
  })
})

describe('classifyCustomersForPreview', () => {
  const customers: WooCustomer[] = [
    { id: 10, email: 'linked@example.com', first_name: 'Linked' },
    { id: 11, email: 'matched@example.com', first_name: 'Matched' },
    { id: 12, email: 'new@example.com', first_name: 'New' },
    { id: 13, first_name: 'NoEmail' },
  ]

  it('splits customers into preview sections', () => {
    const snapshot = classifyCustomersForPreview(
      customers,
      new Set(['10']),
      new Set(['matched@example.com']),
    )

    expect(snapshot.woo_total).toBe(4)
    expect(snapshot.already_linked).toHaveLength(1)
    expect(snapshot.already_linked[0]?.woo_customer_id).toBe(10)
    expect(snapshot.matched_by_email).toHaveLength(1)
    expect(snapshot.matched_by_email[0]?.woo_customer_id).toBe(11)
    expect(snapshot.to_import).toHaveLength(1)
    expect(snapshot.to_import[0]?.woo_customer_id).toBe(12)
    expect(snapshot.skipped).toHaveLength(1)
    expect(snapshot.skipped[0]?.woo_customer_id).toBe(13)
  })

  it('treats customers with stale links as to_import', () => {
    const customers: WooCustomer[] = [
      { id: 10, email: 'deleted@example.com', first_name: 'Was Deleted' },
    ]
    const links = [{ woo_customer_id: '10', contact_id: 'contact-deleted' }]
    const liveContactIds = new Set<string>() // contact was soft-deleted

    const snapshot = classifyCustomersForPreview(
      customers,
      activeLinkedWooCustomerIds(links, liveContactIds),
      new Set(),
    )

    expect(snapshot.already_linked).toHaveLength(0)
    expect(snapshot.to_import).toHaveLength(1)
    expect(snapshot.to_import[0]?.woo_customer_id).toBe(10)
  })
})
