import { describe, expect, it } from 'vitest'
import {
  invoicesToBarData,
  previewLinesToDonutSegments,
  usageLinesToBarData,
  billableUsageNetFromPreview,
  usageConsumptionHint,
} from '@/components/erp/billing/billing-chart-data'

describe('billing-chart-data', () => {
  it('groups preview lines into donut segments', () => {
    const segments = previewLinesToDonutSegments([
      { kind: 'base', label: 'Plan', quantity: '1', unit_price: '59900', amount: '59900.00' },
      { kind: 'usage', label: 'Storage', quantity: '2', unit_price: '12', amount: '24.02' },
      { kind: 'adjustment', label: 'Info', quantity: '0', unit_price: '0', amount: '0.00', isInformational: true },
    ])

    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({ label: 'Plan base', value: 59900 })
    expect(segments[1]).toMatchObject({ label: 'Consumo medido', value: 24.02 })
  })

  it('maps usage lines to bar chart data', () => {
    expect(usageLinesToBarData([
      { label: 'Almacenamiento', amount: '24.02' },
      { label: 'Cero', amount: '0.00' },
    ])).toEqual([
      { label: 'Almacenamiento', value: 24.02 },
    ])
  })

  it('maps recent invoices to bar chart data', () => {
    expect(invoicesToBarData([
      { invoice_number: 'FAC-0001', issue_date: '2026-01-15', total: '50000.00', status: 'paid' },
      { invoice_number: 'FAC-0002', issue_date: '2026-02-15', total: '60000.00', status: 'issued' },
      { invoice_number: 'FAC-VOID', issue_date: '2026-03-15', total: '1000.00', status: 'void' },
    ])).toEqual([
      { label: 'FAC-0001', value: 50000 },
      { label: 'FAC-0002', value: 60000 },
    ])
  })

  it('sums only billable usage lines from preview', () => {
    expect(billableUsageNetFromPreview([
      { kind: 'base', label: 'Plan', quantity: '1', unit_price: '59900', amount: '59900.00' },
      { kind: 'usage', label: 'Storage incluido', quantity: '2', unit_price: '0', amount: '0.00', isInformational: true },
      { kind: 'usage', label: 'Storage extra', quantity: '1', unit_price: '150', amount: '150.00' },
    ])).toBe('150.00')
  })

  it('explains when registered usage is covered by plan', () => {
    expect(usageConsumptionHint('24.02', '0.00')).toContain('cubierto por lo incluido')
  })
})
