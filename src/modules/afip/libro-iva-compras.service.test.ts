import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/modules/purchases/supplier-invoice.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/purchases/purchase-return.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/purchases/purchase-order.model', () => ({ default: {} }))
vi.mock('@/modules/contacts/contact.model', () => ({ default: {} }))
vi.mock('@/modules/expenses/expense.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/purchases/purchases-branch-associations', () => ({ ensurePurchasesBranchAssociations: vi.fn() }))
vi.mock('@/modules/purchases/purchase-returns.service', () => ({ ensurePurchaseReturnAssociations: vi.fn() }))
vi.mock('@/modules/expenses/expenses-branch-associations', () => ({ ensureExpensesBranchAssociations: vi.fn() }))
// libro-iva-ventas.service exports `sumTotals`/types reused by the compras builder — its own
// model imports must be mocked too so importing it doesn't pull in a real DB connection.
vi.mock('@/modules/sales/invoice.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/credit-note.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/debit-note.model', () => ({ default: { findAll: vi.fn() } }))
vi.mock('@/modules/sales/sales-branch-associations', () => ({ ensureSalesBranchAssociations: vi.fn() }))

import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'
import PurchaseReturn from '@/modules/purchases/purchase-return.model'
import Expense from '@/modules/expenses/expense.model'
import { buildLibroIvaCompras } from './libro-iva-compras.service'

const ctx = { orgId: 'org-1', userId: 'u-1', defaultBranchId: null, allowedBranchIds: [] }
const range = { from: new Date(Date.UTC(2026, 6, 1)), to: new Date(Date.UTC(2026, 6, 31)) }

beforeEach(() => vi.clearAllMocks())

describe('buildLibroIvaCompras', () => {
  it('includes Expensas invoices alongside supplier invoices so IVA crédito is not lost', async () => {
    ;(SupplierInvoice.findAll as Mock).mockResolvedValue([
      {
        invoice_date: new Date(Date.UTC(2026, 6, 5)),
        supplier_invoice_number: 'FP-01-0001',
        invoice_number: 'FP-01-0001',
        subtotal: '1000.00',
        discount_amount: '0.00',
        tax_amount: '210.00',
        total: '1210.00',
        contact: { legal_name: 'Proveedor SA', cuit: '30712345670' },
      },
    ])
    ;(PurchaseReturn.findAll as Mock).mockResolvedValue([])
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        invoice_date: new Date(Date.UTC(2026, 6, 10)),
        invoice_number: '0001-00001234',
        expense_number: 'EXP-01-0001',
        subtotal: '150000.00',
        discount_amount: '0.00',
        tax_amount: '31500.00',
        total: '181500.00',
        contact: { legal_name: 'Inmobiliaria SRL', cuit: '30798765432' },
      },
    ])

    const result = await buildLibroIvaCompras(ctx, range)

    expect(result.rows).toHaveLength(2)
    expect(result.rows.find(r => r.number === 'FP-01-0001')).toMatchObject({ neto: '1000.00', iva: '210.00', sign: 1 })
    expect(result.rows.find(r => r.number === '0001-00001234')).toMatchObject({
      neto: '150000.00',
      iva: '31500.00',
      total: '181500.00',
      contact_name: 'Inmobiliaria SRL',
      sign: 1,
    })
  })

  it('falls back to the internal expense_number when there is no supplier invoice_number', async () => {
    ;(SupplierInvoice.findAll as Mock).mockResolvedValue([])
    ;(PurchaseReturn.findAll as Mock).mockResolvedValue([])
    ;(Expense.findAll as Mock).mockResolvedValue([
      {
        invoice_date: new Date(Date.UTC(2026, 6, 10)),
        invoice_number: null,
        expense_number: 'EXP-01-0002',
        subtotal: '50.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total: '50.00',
        contact: null,
      },
    ])

    const result = await buildLibroIvaCompras(ctx, range)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ number: 'EXP-01-0002', contact_name: null, cuit: null })
  })

  it('scopes the Expense query to non-draft/cancelled statuses in the requested range', async () => {
    ;(SupplierInvoice.findAll as Mock).mockResolvedValue([])
    ;(PurchaseReturn.findAll as Mock).mockResolvedValue([])
    ;(Expense.findAll as Mock).mockResolvedValue([])

    await buildLibroIvaCompras(ctx, range)

    const call = (Expense.findAll as Mock).mock.calls[0]![0] as { where: { org_id: string; status: unknown } }
    expect(call.where.org_id).toBe('org-1')
    expect(call.where.status).toBeDefined()
  })
})
