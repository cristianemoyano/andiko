import 'server-only'
import { CronExpressionParser } from 'cron-parser'

export type CronValidationResult = { valid: true } | { valid: false; error: string }

/** Computes the next fire time for a 5-field cron expression in the given IANA timezone. */
export function computeNextRunAt(cronExpression: string, timezone: string, fromDate: Date = new Date()): Date {
  const interval = CronExpressionParser.parse(cronExpression, { currentDate: fromDate, tz: timezone })
  return interval.next().toDate()
}

/** Validates a cron expression, without raising. */
export function validateCronExpression(cronExpression: string): CronValidationResult {
  try {
    CronExpressionParser.parse(cronExpression)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Expresión cron inválida' }
  }
}

/**
 * Smallest gap (in seconds) between two consecutive fires of the expression,
 * sampled from `fromDate`. Used to enforce `min_interval_seconds`.
 */
export function minIntervalSecondsOf(cronExpression: string, timezone: string, fromDate: Date = new Date()): number {
  const interval = CronExpressionParser.parse(cronExpression, { currentDate: fromDate, tz: timezone })
  const first = interval.next().toDate()
  const second = interval.next().toDate()
  return Math.round((second.getTime() - first.getTime()) / 1000)
}
