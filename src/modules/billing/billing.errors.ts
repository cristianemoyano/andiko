import { NextResponse } from 'next/server'

/** Maps known billing service error messages to HTTP responses. */
const ERROR_MAP: Record<string, { status: number; message: string }> = {
  PLAN_NOT_FOUND:                       { status: 404, message: 'Plan no encontrado' },
  PLAN_IN_USE:                          { status: 409, message: 'El plan tiene suscripciones activas' },
  METRIC_NOT_FOUND:                     { status: 404, message: 'Métrica no encontrada' },
  SUBSCRIPTION_NOT_FOUND:               { status: 404, message: 'Suscripción no encontrada' },
  SUBSCRIPTION_ALREADY_EXISTS:          { status: 409, message: 'La organización ya tiene una suscripción activa' },
  BILLING_INVOICE_NOT_FOUND:            { status: 404, message: 'Factura no encontrada' },
  BILLING_INVOICE_ALREADY_ISSUED:       { status: 409, message: 'La factura ya fue emitida' },
  BILLING_INVOICE_PAID_NOT_VOIDABLE:    { status: 409, message: 'No se puede anular una factura pagada' },
  BILLING_INVOICE_ALREADY_VOID:         { status: 409, message: 'La factura ya está anulada' },
  BILLING_INVOICE_HAS_PAYMENTS:         { status: 409, message: 'La factura tiene pagos registrados' },
  BILLING_INVOICE_VOID:                 { status: 409, message: 'La factura está anulada' },
  BILLING_INVOICE_NOT_ISSUED:           { status: 409, message: 'La factura aún no fue emitida' },
  BILLING_INVOICE_ALREADY_PAID:         { status: 409, message: 'La factura ya está pagada' },
  BILLING_PAYMENT_NOT_FOUND:            { status: 404, message: 'Pago no encontrado' },
  BILLING_PAYMENT_INVALID_AMOUNT:       { status: 422, message: 'El monto debe ser mayor a cero' },
  BILLING_PAYMENT_EXCEEDS_BALANCE:      { status: 422, message: 'El monto supera el saldo de la factura' },
}

/**
 * Returns a structured NextResponse for a known billing error, or null if the
 * error is not recognized (caller should rethrow so it bubbles to app logging).
 */
export function billingErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof Error) {
    const mapped = ERROR_MAP[err.message]
    if (mapped) {
      return NextResponse.json({ error: mapped.message, code: err.message }, { status: mapped.status })
    }
  }
  return null
}
