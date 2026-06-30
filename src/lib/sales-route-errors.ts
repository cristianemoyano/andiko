import 'server-only'
import { NextResponse } from 'next/server'
import { SaleLineItemValidationError } from '@/modules/sales/sales-line-items.validation'
import { SaleLineStockError } from '@/modules/sales/sales-line-stock.service'

export function saleLineItemValidationResponse(err: unknown): NextResponse | null {
  if (!(err instanceof SaleLineItemValidationError)) return null
  return NextResponse.json(
    { error: err.message, code: err.code, line: err.line },
    { status: 422 },
  )
}

export function saleLineStockValidationResponse(err: unknown): NextResponse | null {
  if (!(err instanceof SaleLineStockError)) return null
  return NextResponse.json(
    {
      error: err.message,
      code: err.code,
      line: err.line,
      available: err.available,
      requested: err.requested,
    },
    { status: 422 },
  )
}
