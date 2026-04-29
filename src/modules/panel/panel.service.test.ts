import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  default: { query: vi.fn() },
}))

import sequelize from '@/lib/db'
import { getPanelKpis, getPanelCounts, getPanelRecentInvoices, getPanelActivity } from './panel.service'
import type { PanelFilters } from './panel.service'

const ORG_ID = 'org-123'
const BASE_FILTERS: PanelFilters = { period: 'last_month' }

beforeEach(() => vi.clearAllMocks())

describe('panel.service', () => {
  describe('getPanelKpis', () => {
    it('returns parsed numeric values for facturado and cobrado', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery
        .mockResolvedValueOnce([{ current: '150000.00', previous: '100000.00' }] as never) // facturado
        .mockResolvedValueOnce([{ current: '120000.00', previous: '130000.00' }] as never) // cobrado
        .mockResolvedValueOnce([{ value: '30000.00', overdue_count: '2' }] as never)       // cxc
        .mockResolvedValueOnce([] as never)                                                  // spark

      const result = await getPanelKpis(ORG_ID, BASE_FILTERS)

      expect(result.facturado.value).toBe(150000)
      expect(result.facturado.pct_change).toBe(50)
      expect(result.cobrado.value).toBe(120000)
      expect(result.cobrado.pct_change).toBe(-8)
      expect(result.por_cobrar.value).toBe(30000)
      expect(result.por_cobrar.overdue_count).toBe(2)
      expect(result.saldo_cuenta).toBeNull()
    })

    it('returns zero pct_change when previous period is zero', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery
        .mockResolvedValueOnce([{ current: '50000.00', previous: '0' }] as never)
        .mockResolvedValueOnce([{ current: '0', previous: '0' }] as never)
        .mockResolvedValueOnce([{ value: '0', overdue_count: '0' }] as never)
        .mockResolvedValueOnce([] as never)

      const result = await getPanelKpis(ORG_ID, BASE_FILTERS)

      expect(result.facturado.pct_change).toBe(0)
      expect(result.cobrado.pct_change).toBe(0)
    })

    it('returns empty spark array when no monthly data', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery
        .mockResolvedValueOnce([{ current: '0', previous: '0' }] as never)
        .mockResolvedValueOnce([{ current: '0', previous: '0' }] as never)
        .mockResolvedValueOnce([{ value: '0', overdue_count: '0' }] as never)
        .mockResolvedValueOnce([] as never)

      const result = await getPanelKpis(ORG_ID, BASE_FILTERS)

      expect(result.facturado.spark).toEqual([])
    })
  })

  describe('getPanelCounts', () => {
    it('returns parsed integer counts', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery
        .mockResolvedValueOnce([{ count: '1284' }] as never) // products
        .mockResolvedValueOnce([{ count: '347' }] as never)  // clients
        .mockResolvedValueOnce([{ count: '89' }] as never)   // suppliers
        .mockResolvedValueOnce([{ count: '623' }] as never)  // comprobantes

      const result = await getPanelCounts(ORG_ID, BASE_FILTERS)

      expect(result.productos).toBe(1284)
      expect(result.clientes).toBe(347)
      expect(result.proveedores).toBe(89)
      expect(result.comprobantes).toBe(623)
    })

    it('returns zero counts when no data', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }] as never)
        .mockResolvedValueOnce([{ count: '0' }] as never)
        .mockResolvedValueOnce([{ count: '0' }] as never)
        .mockResolvedValueOnce([{ count: '0' }] as never)

      const result = await getPanelCounts(ORG_ID, BASE_FILTERS)

      expect(result.productos).toBe(0)
    })
  })

  describe('getPanelRecentInvoices', () => {
    it('formats dates and amounts in Argentine locale', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery.mockResolvedValueOnce([
        {
          invoice_number: 'FC-A 0001-00004535',
          legal_name: 'Distribuidora Sur S.A.',
          trade_name: null,
          issue_date: new Date('2026-04-19T12:00:00Z'),
          total: '124800.00',
          status: 'paid',
        },
      ] as never)

      const result = await getPanelRecentInvoices(ORG_ID, BASE_FILTERS)

      expect(result).toHaveLength(1)
      expect(result[0].numero).toBe('FC-A 0001-00004535')
      expect(result[0].cliente).toBe('Distribuidora Sur S.A.')
      expect(result[0].total).toContain('124')
      expect(result[0].status).toBe('paid')
    })

    it('prefers trade_name over legal_name', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery.mockResolvedValueOnce([
        {
          invoice_number: 'FC-A 0001-00000001',
          legal_name: 'Razón Social S.A.',
          trade_name: 'Nombre Comercial',
          issue_date: new Date(),
          total: '1000.00',
          status: 'issued',
        },
      ] as never)

      const [inv] = await getPanelRecentInvoices(ORG_ID, BASE_FILTERS)
      expect(inv.cliente).toBe('Nombre Comercial')
    })

    it('falls back to — when no client linked', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      mockQuery.mockResolvedValueOnce([
        {
          invoice_number: 'FC-B 0001-00000001',
          legal_name: null,
          trade_name: null,
          issue_date: new Date(),
          total: '500.00',
          status: 'draft',
        },
      ] as never)

      const [inv] = await getPanelRecentInvoices(ORG_ID, BASE_FILTERS)
      expect(inv.cliente).toBe('—')
    })
  })

  describe('getPanelActivity', () => {
    it('returns activity items with relative time', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      const recentDate = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      mockQuery.mockResolvedValueOnce([
        { type: 'invoice', text: 'FC-A 00001 — Cliente S.A.', occurred_at: recentDate },
      ] as never)

      const result = await getPanelActivity(ORG_ID, BASE_FILTERS)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('invoice')
      expect(result[0].time).toMatch(/^hace \d+ min$/)
    })

    it('shows "ayer" for yesterday events', async () => {
      const mockQuery = vi.mocked(sequelize.query)
      const yesterday = new Date(Date.now() - 25 * 3600 * 1000)
      mockQuery.mockResolvedValueOnce([
        { type: 'invoice', text: 'FC-A 00002 — Empresa', occurred_at: yesterday },
      ] as never)

      const result = await getPanelActivity(ORG_ID, BASE_FILTERS)
      expect(result[0].time).toBe('ayer')
    })
  })
})
