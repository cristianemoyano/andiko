import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { TenantContext } from '@/lib/tenancy'
import type { TrialBalanceQuery } from './journal-entry.schema'

export type TrialBalanceRow = {
  account_id: string
  code: string
  name: string
  type: string
  total_debit: string
  total_credit: string
  saldo_debit: string
  saldo_credit: string
}

export type TrialBalance = {
  from: string | null
  to: string | null
  branch_id: string | null
  rows: TrialBalanceRow[]
  totals: {
    total_debit: string
    total_credit: string
    saldo_debit: string
    saldo_credit: string
  }
}

type RawRow = {
  account_id: string
  code: string
  name: string
  type: string
  total_debit: string
  total_credit: string
}

/**
 * Balance de sumas y saldos: agrega líneas de asientos contabilizados (posted)
 * por cuenta, en un rango de fechas opcional, con filtro opcional por sucursal
 * (centro de costo).
 */
export async function getTrialBalance(query: TrialBalanceQuery, ctx: TenantContext): Promise<TrialBalance> {
  const rows = await sequelize.query<RawRow>(
    `SELECT a.id AS account_id, a.code, a.name, a.type::text AS type,
            COALESCE(SUM(l.debit), 0)  AS total_debit,
            COALESCE(SUM(l.credit), 0) AS total_credit
       FROM accounts a
       JOIN journal_entry_lines l ON l.account_id = a.id AND l.deleted_at IS NULL
       JOIN journal_entries e     ON e.id = l.entry_id   AND e.deleted_at IS NULL
      WHERE a.org_id = :orgId
        AND e.status = 'posted'
        AND (:fromDate::date IS NULL OR e.entry_date >= :fromDate::date)
        AND (:toDate::date   IS NULL OR e.entry_date <= :toDate::date)
        AND (:branchId::uuid IS NULL OR l.branch_id = :branchId::uuid)
      GROUP BY a.id, a.code, a.name, a.type
     HAVING COALESCE(SUM(l.debit), 0) <> 0 OR COALESCE(SUM(l.credit), 0) <> 0
      ORDER BY a.code ASC`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        orgId: ctx.orgId,
        fromDate: query.from ?? null,
        toDate: query.to ?? null,
        branchId: query.branch_id ?? null,
      },
    },
  )

  let totalDebit = new Decimal(0)
  let totalCredit = new Decimal(0)
  let saldoDebitTotal = new Decimal(0)
  let saldoCreditTotal = new Decimal(0)

  const mapped: TrialBalanceRow[] = rows.map(row => {
    const debit = new Decimal(row.total_debit)
    const credit = new Decimal(row.total_credit)
    const saldo = debit.minus(credit)
    const saldoDebit = saldo.gt(0) ? saldo : new Decimal(0)
    const saldoCredit = saldo.lt(0) ? saldo.abs() : new Decimal(0)

    totalDebit = totalDebit.plus(debit)
    totalCredit = totalCredit.plus(credit)
    saldoDebitTotal = saldoDebitTotal.plus(saldoDebit)
    saldoCreditTotal = saldoCreditTotal.plus(saldoCredit)

    return {
      account_id: String(row.account_id),
      code: row.code,
      name: row.name,
      type: row.type,
      total_debit: debit.toFixed(2),
      total_credit: credit.toFixed(2),
      saldo_debit: saldoDebit.toFixed(2),
      saldo_credit: saldoCredit.toFixed(2),
    }
  })

  return {
    from: query.from ?? null,
    to: query.to ?? null,
    branch_id: query.branch_id ?? null,
    rows: mapped,
    totals: {
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      saldo_debit: saldoDebitTotal.toFixed(2),
      saldo_credit: saldoCreditTotal.toFixed(2),
    },
  }
}
