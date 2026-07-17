import 'server-only'
import { QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import sequelize from '@/lib/db'
import type { TenantContext } from '@/lib/tenancy'
import type { CsvHeader } from '@/lib/csv'
import type { TrialBalanceQuery } from './journal-entry.schema'

/** Cota dura para no generar CSVs sin límite (AGENTS: no unbounded queries). */
const EXPORT_ROW_LIMIT = 50_000

export const LIBRO_DIARIO_CSV_HEADERS: CsvHeader[] = [
  { key: 'numero', label: 'Número' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'cuenta_codigo', label: 'Código de cuenta' },
  { key: 'cuenta_nombre', label: 'Cuenta' },
  { key: 'descripcion', label: 'Descripción' },
  { key: 'debe', label: 'Debe' },
  { key: 'haber', label: 'Haber' },
  { key: 'origen', label: 'Origen' },
  { key: 'sucursal', label: 'Sucursal' },
]

export type LibroDiarioRow = {
  numero: string
  fecha: string
  cuenta_codigo: string
  cuenta_nombre: string
  descripcion: string
  debe: string
  haber: string
  origen: string
  sucursal: string
}

type RawLibroDiarioRow = {
  entry_number: string
  entry_date: string
  account_code: string
  account_name: string
  entry_description: string | null
  line_description: string | null
  debit: string
  credit: string
  source_type: string | null
  branch_name: string | null
}

/**
 * Libro diario para el estudio contable: líneas de asientos contabilizados,
 * ordenadas por fecha y número de asiento.
 */
export async function getLibroDiarioRows(
  query: TrialBalanceQuery,
  ctx: TenantContext,
): Promise<LibroDiarioRow[]> {
  const rows = await sequelize.query<RawLibroDiarioRow>(
    `SELECT e.entry_number, e.entry_date::text AS entry_date,
            a.code AS account_code, a.name AS account_name,
            e.description AS entry_description, l.description AS line_description,
            l.debit, l.credit, e.source_type,
            b.name AS branch_name
       FROM journal_entries e
       JOIN journal_entry_lines l ON l.entry_id = e.id AND l.deleted_at IS NULL
       JOIN accounts a            ON a.id = l.account_id
       LEFT JOIN branches b       ON b.id = l.branch_id
      WHERE e.org_id = :orgId
        AND e.deleted_at IS NULL
        AND e.status = 'posted'
        AND (:fromDate::date IS NULL OR e.entry_date >= :fromDate::date)
        AND (:toDate::date   IS NULL OR e.entry_date <= :toDate::date)
        AND (:branchId::uuid IS NULL OR l.branch_id = :branchId::uuid)
      ORDER BY e.entry_date ASC, e.entry_number ASC, l.sort_order ASC
      LIMIT ${EXPORT_ROW_LIMIT}`,
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

  return rows.map(row => ({
    numero: row.entry_number,
    fecha: row.entry_date.slice(0, 10),
    cuenta_codigo: row.account_code,
    cuenta_nombre: row.account_name,
    descripcion: row.line_description ?? row.entry_description ?? '',
    debe: new Decimal(row.debit).toFixed(2),
    haber: new Decimal(row.credit).toFixed(2),
    origen: row.source_type ?? 'manual',
    sucursal: row.branch_name ?? '',
  }))
}

export const SUMAS_Y_SALDOS_CSV_HEADERS: CsvHeader[] = [
  { key: 'codigo', label: 'Código' },
  { key: 'cuenta', label: 'Cuenta' },
  { key: 'sumas_debe', label: 'Sumas Debe' },
  { key: 'sumas_haber', label: 'Sumas Haber' },
  { key: 'saldo_deudor', label: 'Saldo Deudor' },
  { key: 'saldo_acreedor', label: 'Saldo Acreedor' },
]

export type SumasYSaldosCsvRow = {
  codigo: string
  cuenta: string
  sumas_debe: string
  sumas_haber: string
  saldo_deudor: string
  saldo_acreedor: string
}

export function trialBalanceToCsvRows(rows: {
  code: string
  name: string
  total_debit: string
  total_credit: string
  saldo_debit: string
  saldo_credit: string
}[]): SumasYSaldosCsvRow[] {
  return rows.map(row => ({
    codigo: row.code,
    cuenta: row.name,
    sumas_debe: row.total_debit,
    sumas_haber: row.total_credit,
    saldo_deudor: row.saldo_debit,
    saldo_acreedor: row.saldo_credit,
  }))
}
