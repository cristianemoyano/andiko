import 'server-only'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import AccountingPeriod from './accounting-period.model'

/** Normaliza Date o string a `YYYY-MM-DD` para comparar contra columnas DATE. */
export function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

export function nextDay(dateOnly: string): string {
  const date = new Date(`${dateOnly}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export async function isDateInClosedPeriod(
  orgId: string,
  date: Date | string,
  t?: Transaction,
): Promise<boolean> {
  const dateOnly = toDateOnly(date)
  const count = await AccountingPeriod.count({
    where: {
      org_id: orgId,
      status: 'closed',
      start_date: { [Op.lte]: dateOnly },
      end_date: { [Op.gte]: dateOnly },
    },
    transaction: t,
  })
  return count > 0
}

export async function getLatestClosedEndDate(
  orgId: string,
  t?: Transaction,
): Promise<string | null> {
  const period = await AccountingPeriod.findOne({
    where: { org_id: orgId, status: 'closed' },
    attributes: ['end_date'],
    order: [['end_date', 'DESC']],
    transaction: t,
  })
  return period ? toDateOnly(period.end_date) : null
}

export type ClampResult = { dateOnly: string; clamped: boolean }

/**
 * Si la fecha cae dentro de un período cerrado, la reimputa al día siguiente
 * del último cierre (garantizado abierto: ningún período cerrado termina después).
 */
export async function clampDateOutOfClosedPeriods(
  orgId: string,
  date: Date | string,
  t?: Transaction,
): Promise<ClampResult> {
  const dateOnly = toDateOnly(date)
  if (!(await isDateInClosedPeriod(orgId, dateOnly, t))) {
    return { dateOnly, clamped: false }
  }
  const latestEnd = await getLatestClosedEndDate(orgId, t)
  return { dateOnly: nextDay(latestEnd ?? dateOnly), clamped: true }
}
