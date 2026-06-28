import { describe, expect, it } from 'vitest'
import { activeImportedWooOrderIds } from './woo-sync-links.utils'
import { activeLinkedWooCustomerIds } from './woo-customers.utils'

describe('activeImportedWooOrderIds', () => {
  it('only includes orders linked to live sales orders', () => {
    const links = [
      { woo_order_id: '100', sales_order_id: 'so-live' },
      { woo_order_id: '101', sales_order_id: 'so-deleted' },
      { woo_order_id: '102', sales_order_id: null },
    ]
    const ids = activeImportedWooOrderIds(links, new Set(['so-live']))
    expect([...ids]).toEqual(['100'])
  })
})

describe('activeLinkedWooCustomerIds', () => {
  it('excludes links to deleted contacts', () => {
    const links = [{ woo_customer_id: '5', contact_id: 'c-deleted' }]
    expect([...activeLinkedWooCustomerIds(links, new Set())]).toEqual([])
  })
})
