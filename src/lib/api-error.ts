import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
} from 'sequelize'
import { ForbiddenError } from '@/lib/permissions'
import { tenancyErrorResponse } from '@/lib/tenancy'
import logger from '@/lib/logger'

/**
 * Catch-all mapper for errors that escape a route handler. Routes keep their local
 * handling; this net guarantees no unstructured 500s and no leaked stack traces.
 * Always returns the `{ error, code, details? }` contract.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Datos inválidos.', code: 'VALIDATION_ERROR', details: err.flatten() },
      { status: 400 },
    )
  }

  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const tenancyResponse = tenancyErrorResponse(err)
  if (tenancyResponse) return tenancyResponse

  if (err instanceof UniqueConstraintError || err instanceof ForeignKeyConstraintError) {
    return NextResponse.json(
      { error: 'El registro entra en conflicto con datos existentes.', code: 'CONFLICT' },
      { status: 409 },
    )
  }

  if (err instanceof SequelizeValidationError) {
    return NextResponse.json(
      { error: 'Los datos no pasaron la validación.', code: 'UNPROCESSABLE' },
      { status: 422 },
    )
  }

  logger.error({ err }, 'unhandled api error')
  return NextResponse.json(
    { error: 'Error interno del servidor.', code: 'INTERNAL' },
    { status: 500 },
  )
}
