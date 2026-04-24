import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { IvaRate } from '@/types'

// ─── Document numbering ──────────────────────────────────────────────────────

type PurchaseDocType = 'purchase_order' | 'receipt' | 'supplier_invoice' | 'supplier_payment'

const DOC_PREFIXES: Record<PurchaseDocType, string> = {
  purchase_order:   'OC',
  receipt:          'REC',
  supplier_invoice: 'FP',
  supplier_payment: 'PP',
}

/**
 * Siguiente número de documento de compras por organización + sucursal.
 * Formato: `{OC|REC|FP|PP}-{branch_code 2 dígitos}-{secuencia 4 dígitos}` (ej. `OC-01-0001`).
 */
export async function nextPurchaseDocNumber(
  orgId: string,
  branchId: string,
  type: PurchaseDocType,
  t: Transaction,
): Promise<string> {
  if (!orgId || !branchId) {
    throw new Error('ORG_CONTEXT_REQUIRED')
  }

  const { default: Branch } = await import('@/modules/auth/branch.model')
  const branch = await Branch.findOne({
    where: { id: branchId, org_id: orgId, is_active: true },
    attributes: ['branch_code'],
    transaction: t,
  })
  if (!branch) {
    throw new Error('BRANCH_NOT_FOUND')
  }

  const rows = await sequelize.query<{ last_number: number }>(
    `INSERT INTO document_sequences (org_id, branch_id, document_type, last_number)
     VALUES (:orgId, :branchId, :type, 1)
     ON CONFLICT (org_id, branch_id, document_type)
     DO UPDATE SET last_number = document_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { orgId, branchId, type }, type: QueryTypes.SELECT, transaction: t },
  )
  const num = rows[0].last_number
  const bc = String(branch.branch_code).padStart(2, '0')
  return `${DOC_PREFIXES[type]}-${bc}-${String(num).padStart(4, '0')}`
}

// ─── Financial math (Decimal-safe) ──────────────────────────────────────────

export interface LineItemTotals {
  subtotal: string
  discount_amount: string
  tax_base: string
  tax_amount: string
  total: string
}

export function calcLineItem(
  quantity: string | number,
  unit_price: string | number,
  discount_pct: string | number,
  iva_rate: IvaRate,
): LineItemTotals {
  const qty     = new Decimal(quantity)
  const price   = new Decimal(unit_price)
  const discPct = new Decimal(discount_pct)
  const ivaRate = new Decimal(iva_rate).div(100)

  const subtotal        = qty.mul(price)
  const discount_amount = subtotal.mul(discPct).div(100)
  const tax_base        = subtotal.minus(discount_amount)
  const tax_amount      = tax_base.mul(ivaRate)
  const total           = tax_base.plus(tax_amount)

  return {
    subtotal:        subtotal.toFixed(2),
    discount_amount: discount_amount.toFixed(2),
    tax_base:        tax_base.toFixed(2),
    tax_amount:      tax_amount.toFixed(2),
    total:           total.toFixed(2),
  }
}

export interface DocumentTotals {
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
}

export function calcDocumentTotals(items: LineItemTotals[]): DocumentTotals {
  const zero = new Decimal(0)
  const subtotal        = items.reduce((acc, i) => acc.plus(i.subtotal), zero)
  const discount_amount = items.reduce((acc, i) => acc.plus(i.discount_amount), zero)
  const tax_amount      = items.reduce((acc, i) => acc.plus(i.tax_amount), zero)
  const total           = items.reduce((acc, i) => acc.plus(i.total), zero)

  return {
    subtotal:        subtotal.toFixed(2),
    discount_amount: discount_amount.toFixed(2),
    tax_amount:      tax_amount.toFixed(2),
    total:           total.toFixed(2),
  }
}

// ─── Payment due date ────────────────────────────────────────────────────────

export function calcDueDate(issueDate: Date, paymentCondition: string): Date | null {
  const days: Record<string, number> = {
    cash:   0,
    net_30: 30,
    net_60: 60,
    net_90: 90,
  }
  const d = days[paymentCondition]
  if (d === undefined) return null
  const due = new Date(issueDate)
  due.setDate(due.getDate() + d)
  return due
}
