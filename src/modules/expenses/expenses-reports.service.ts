import 'server-only'
import { QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'
import { OPEN_PAYABLE_EXPENSE_STATUSES } from './expense.constants'
import type { ExpensesReportQuery } from './expenses-reports.schema'

const KIND_LABEL: Record<string, string> = {
  one_off: 'Único',
  recurring_occurrence: 'Recurrente',
  installment_plan: 'Plan / cuotas',
}

function resolveRange(query: ExpensesReportQuery): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from
    ? new Date(query.from)
    : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
  return { from, to }
}

export async function getExpensesReport(query: ExpensesReportQuery, orgId: string) {
  const { from, to } = resolveRange(query)
  const branchFilter = query.branch_id ? 'AND e.branch_id = :branchId' : ''
  const replacements: Record<string, unknown> = { orgId, from, to }
  if (query.branch_id) replacements.branchId = query.branch_id

  const [summaryRows, byKindRows, byPeriodRows, bySupplierRows] = await Promise.all([
    sequelize.query<{
      total: string
      tax_amount: string
      open_balance: string
      overdue_count: string
      count: string
    }>(`
      SELECT
        COALESCE(SUM(CASE WHEN e.status NOT IN ('draft', 'cancelled') THEN CAST(e.total AS NUMERIC) END), 0)::text AS total,
        COALESCE(SUM(CASE WHEN e.status NOT IN ('draft', 'cancelled') THEN CAST(e.tax_amount AS NUMERIC) END), 0)::text AS tax_amount,
        COALESCE(SUM(CASE WHEN e.status IN (:openStatuses) THEN CAST(e.balance AS NUMERIC) END), 0)::text AS open_balance,
        COUNT(CASE WHEN e.status IN (:openStatuses) AND e.due_date < NOW() AND CAST(e.balance AS NUMERIC) > 0 THEN 1 END)::text AS overdue_count,
        COUNT(CASE WHEN e.status NOT IN ('draft', 'cancelled') THEN 1 END)::text AS count
      FROM expenses e
      WHERE e.org_id = :orgId AND e.deleted_at IS NULL
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to
        ${branchFilter}
    `, {
      replacements: { ...replacements, openStatuses: [...OPEN_PAYABLE_EXPENSE_STATUSES] },
      type: QueryTypes.SELECT,
    }),

    sequelize.query<{ kind: string; total: string; count: string }>(`
      SELECT e.kind,
             COALESCE(SUM(CAST(e.total AS NUMERIC)), 0)::text AS total,
             COUNT(*)::text AS count
      FROM expenses e
      WHERE e.org_id = :orgId AND e.deleted_at IS NULL
        AND e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to
        ${branchFilter}
      GROUP BY e.kind
      ORDER BY SUM(CAST(e.total AS NUMERIC)) DESC
    `, { replacements, type: QueryTypes.SELECT }),

    sequelize.query<{ label: string; total: string }>(`
      SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(e.invoice_date, e.created_at)), 'Mon YYYY') AS label,
             COALESCE(SUM(CAST(e.total AS NUMERIC)), 0)::text AS total
      FROM expenses e
      WHERE e.org_id = :orgId AND e.deleted_at IS NULL
        AND e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to
        ${branchFilter}
      GROUP BY DATE_TRUNC('month', COALESCE(e.invoice_date, e.created_at))
      ORDER BY DATE_TRUNC('month', COALESCE(e.invoice_date, e.created_at))
    `, { replacements, type: QueryTypes.SELECT }),

    sequelize.query<{ label: string; total: string }>(`
      SELECT c.legal_name AS label,
             COALESCE(SUM(CAST(e.total AS NUMERIC)), 0)::text AS total
      FROM expenses e
      JOIN contacts c ON c.id = e.contact_id
      WHERE e.org_id = :orgId AND e.deleted_at IS NULL
        AND e.status NOT IN ('draft', 'cancelled')
        AND COALESCE(e.invoice_date, e.created_at) >= :from
        AND COALESCE(e.invoice_date, e.created_at) <= :to
        ${branchFilter}
      GROUP BY c.legal_name
      ORDER BY SUM(CAST(e.total AS NUMERIC)) DESC
      LIMIT 8
    `, { replacements, type: QueryTypes.SELECT }),
  ])

  const summary = summaryRows[0]

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary: {
      total: parseFloat(summary?.total ?? '0'),
      tax_amount: parseFloat(summary?.tax_amount ?? '0'),
      open_balance: parseFloat(summary?.open_balance ?? '0'),
      overdue_count: parseInt(summary?.overdue_count ?? '0', 10),
      count: parseInt(summary?.count ?? '0', 10),
    },
    by_kind: byKindRows.map(r => ({
      kind: r.kind,
      label: KIND_LABEL[r.kind] ?? r.kind,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    })),
    by_period: byPeriodRows.map(r => ({
      label: r.label,
      total: parseFloat(r.total),
    })),
    by_supplier: bySupplierRows.map(r => ({
      label: r.label,
      total: parseFloat(r.total),
    })),
  }
}
