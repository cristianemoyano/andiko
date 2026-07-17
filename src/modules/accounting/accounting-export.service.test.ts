import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TenantContext } from '@/lib/tenancy'

vi.mock('server-only', () => ({}))

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }))
vi.mock('@/lib/db', () => ({ default: { query: queryMock } }))

import { getLibroDiarioRows, trialBalanceToCsvRows } from './accounting-export.service'

const ctx: TenantContext = { orgId: 'org-1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }

describe('accounting/accounting-export.service getLibroDiarioRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps raw rows to Spanish CSV columns with two-decimal amounts', async () => {
    queryMock.mockResolvedValue([
      {
        entry_number: 'AS-000001', entry_date: '2026-06-15', account_code: '4.1.01',
        account_name: 'Ventas', entry_description: 'Factura FAC-0001', line_description: null,
        debit: '0', credit: '121', source_type: 'sales_invoice', branch_name: 'Casa central',
      },
      {
        entry_number: 'AS-000002', entry_date: '2026-06-16', account_code: '1.1.01.01',
        account_name: 'Caja', entry_description: null, line_description: 'Cobro manual',
        debit: '50.5', credit: '0', source_type: null, branch_name: null,
      },
    ])

    const rows = await getLibroDiarioRows({ from: '2026-06-01', to: '2026-06-30' }, ctx)

    expect(rows[0]).toEqual({
      numero: 'AS-000001', fecha: '2026-06-15', cuenta_codigo: '4.1.01', cuenta_nombre: 'Ventas',
      descripcion: 'Factura FAC-0001', debe: '0.00', haber: '121.00', origen: 'sales_invoice', sucursal: 'Casa central',
    })
    expect(rows[1]).toMatchObject({ descripcion: 'Cobro manual', debe: '50.50', origen: 'manual', sucursal: '' })
  })

  it('filters posted entries by org, date range and branch with a hard LIMIT', async () => {
    queryMock.mockResolvedValue([])
    await getLibroDiarioRows({ from: '2026-01-01', to: '2026-12-31', branch_id: 'b1' }, ctx)

    const sql = queryMock.mock.calls[0]![0] as string
    const opts = queryMock.mock.calls[0]![1] as { replacements: Record<string, unknown> }
    expect(sql).toContain("e.status = 'posted'")
    expect(sql).toContain('LIMIT 50000')
    expect(opts.replacements).toMatchObject({
      orgId: 'org-1', fromDate: '2026-01-01', toDate: '2026-12-31', branchId: 'b1',
    })
  })
})

describe('accounting/accounting-export.service trialBalanceToCsvRows', () => {
  it('renames trial balance fields to Spanish CSV keys', () => {
    const rows = trialBalanceToCsvRows([
      { code: '4.1.01', name: 'Ventas', total_debit: '0.00', total_credit: '600.00', saldo_debit: '0.00', saldo_credit: '600.00' },
    ])
    expect(rows).toEqual([
      { codigo: '4.1.01', cuenta: 'Ventas', sumas_debe: '0.00', sumas_haber: '600.00', saldo_deudor: '0.00', saldo_acreedor: '600.00' },
    ])
  })
})
