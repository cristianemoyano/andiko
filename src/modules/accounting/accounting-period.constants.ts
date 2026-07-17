/** source_type de los asientos de cierre/reapertura de período (client-safe). */
export const CLOSING_SOURCE_TYPES = ['period_close', 'period_close_reversal'] as const

export const ACCOUNTING_PERIOD_STATUSES = ['closed', 'reopened'] as const
export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number]

/** Cuenta de patrimonio contra la que se cancela el resultado al cerrar. */
export const PERIOD_CLOSE_RESULT_ACCOUNT_CODE = '3.2.02'
