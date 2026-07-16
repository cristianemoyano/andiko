import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/config/env', () => ({ env: { AUTH_URL: 'https://erp.test' } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('./low-stock-alert-queue.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('./stock-item.model', () => ({
  default: { findOne: vi.fn() },
}))
vi.mock('./warehouse.model', () => ({ default: class Warehouse {} }))
vi.mock('@/modules/catalog/product-variant.model', () => ({ default: class ProductVariant {} }))
vi.mock('@/modules/catalog/product.model', () => ({ default: class Product {} }))
vi.mock('@/modules/auth/organization-setting.model', () => ({
  default: { findOne: vi.fn() },
}))
vi.mock('@/modules/auth/user.model', () => ({
  default: { findAll: vi.fn() },
}))
vi.mock('@/modules/auth/organization.model', () => ({
  default: { findByPk: vi.fn() },
}))
vi.mock('@/modules/communications/email-templates.service', () => ({
  getEffectiveEmailTemplates: vi.fn(),
}))
vi.mock('@/modules/notifications/emit-notification.service', () => ({
  emitNotification: vi.fn().mockResolvedValue({ status: 'sent' }),
}))

import LowStockAlertQueue from './low-stock-alert-queue.model'
import StockItem from './stock-item.model'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import User from '@/modules/auth/user.model'
import Organization from '@/modules/auth/organization.model'
import { getEffectiveEmailTemplates } from '@/modules/communications/email-templates.service'
import { emitNotification } from '@/modules/notifications/emit-notification.service'
import { drainPendingLowStockAlerts } from './low-stock-alert.service'

const STOCK_ITEM_ID = '550e8400-e29b-41d4-a716-446655440013'

function makeQueueRow(overrides: Partial<{ org_id: string; stock_item_id: string }> = {}) {
  return {
    org_id: 'org-1',
    stock_item_id: STOCK_ITEM_ID,
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeStockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: STOCK_ITEM_ID,
    quantity: '2.00',
    minimum_quantity: '10.00',
    last_low_stock_alert_at: null,
    update: vi.fn().mockResolvedValue(undefined),
    variant: { name: '8mm', sku: 'SKU-1', product: { name: 'Tornillo' } },
    warehouse: { name: 'Depósito Central' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ low_stock_alert: { enabled: true } })
  ;(Organization.findByPk as Mock).mockResolvedValue({ name: 'Mi Empresa' })
  ;(OrganizationSetting.findOne as Mock).mockResolvedValue({ low_stock_alert_recipient_user_ids: ['u1', 'u2'] })
  ;(User.findAll as Mock).mockResolvedValue([{ id: 'u1', email: 'a@test.com' }, { id: 'u2', email: 'b@test.com' }])
})

describe('drainPendingLowStockAlerts', () => {
  it('returns sent_count 0 when the queue is empty', async () => {
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([])

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 0 })
    expect(StockItem.findOne).not.toHaveBeenCalled()
  })

  it('sends to every configured recipient and updates the cooldown, then drains the row', async () => {
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])
    const item = makeStockItem()
    ;(StockItem.findOne as Mock).mockResolvedValue(item)

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 2 })
    expect(emitNotification).toHaveBeenCalledTimes(2)
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'inventory.stock_low',
        recipient: { kind: 'email', address: 'a@test.com' },
        payload: expect.objectContaining({ product_name: 'Tornillo', variant_name: '8mm', warehouse_name: 'Depósito Central' }),
      }),
      { orgId: 'org-1', actorId: null },
    )
    expect(item.update).toHaveBeenCalledWith({ last_low_stock_alert_at: expect.any(Date) })
    expect(row.destroy).toHaveBeenCalled()
  })

  it('skips sending when the item is no longer below minimum, but still drains the row', async () => {
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])
    ;(StockItem.findOne as Mock).mockResolvedValue(makeStockItem({ quantity: '20.00', minimum_quantity: '10.00' }))

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 0 })
    expect(emitNotification).not.toHaveBeenCalled()
    expect(row.destroy).toHaveBeenCalled()
  })

  it('respects the per-item cooldown', async () => {
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])
    ;(StockItem.findOne as Mock).mockResolvedValue(
      makeStockItem({ last_low_stock_alert_at: new Date() }),
    )

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 0 })
    expect(emitNotification).not.toHaveBeenCalled()
    expect(row.destroy).toHaveBeenCalled()
  })

  it('drains the row without sending when the org disabled the template', async () => {
    ;(getEffectiveEmailTemplates as Mock).mockResolvedValue({ low_stock_alert: { enabled: false } })
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 0 })
    expect(StockItem.findOne).not.toHaveBeenCalled()
    expect(emitNotification).not.toHaveBeenCalled()
    expect(row.destroy).toHaveBeenCalled()
  })

  it('skips sending when there are no configured recipients', async () => {
    ;(OrganizationSetting.findOne as Mock).mockResolvedValue({ low_stock_alert_recipient_user_ids: [] })
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])
    ;(StockItem.findOne as Mock).mockResolvedValue(makeStockItem())

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 0 })
    expect(emitNotification).not.toHaveBeenCalled()
    expect(row.destroy).toHaveBeenCalled()
  })

  it('one bad row does not stop the rest of the queue from draining', async () => {
    const rowA = makeQueueRow({ stock_item_id: 'item-bad' })
    const rowB = makeQueueRow({ stock_item_id: 'item-1' })
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([rowA, rowB])
    ;(StockItem.findOne as Mock)
      .mockRejectedValueOnce(new Error('DB exploded'))
      .mockResolvedValueOnce(makeStockItem())

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 2 })
    expect(rowA.destroy).toHaveBeenCalled()
    expect(rowB.destroy).toHaveBeenCalled()
  })

  it('a recipient email failure does not stop the other recipients', async () => {
    ;(emitNotification as Mock)
      .mockRejectedValueOnce(new Error('SMTP down'))
      .mockResolvedValueOnce({ status: 'sent' })
    const row = makeQueueRow()
    ;(LowStockAlertQueue.findAll as Mock).mockResolvedValue([row])
    ;(StockItem.findOne as Mock).mockResolvedValue(makeStockItem())

    const result = await drainPendingLowStockAlerts('org-1')

    expect(result).toEqual({ sent_count: 1 })
    expect(row.destroy).toHaveBeenCalled()
  })
})
