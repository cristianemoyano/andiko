import { NextResponse } from 'next/server'
import { TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'

const ENTRY_ERROR_MAP: Record<string, { message: string; code: string; status: number }> = {
  ENTRY_NOT_FOUND:        { message: 'Asiento no encontrado', code: 'NOT_FOUND', status: 404 },
  ENTRY_NOT_EDITABLE:     { message: 'Solo se pueden editar asientos en borrador', code: 'NOT_EDITABLE', status: 409 },
  ENTRY_NOT_DELETABLE:    { message: 'Solo se pueden eliminar asientos en borrador', code: 'NOT_DELETABLE', status: 409 },
  ENTRY_ALREADY_POSTED:   { message: 'El asiento ya está contabilizado', code: 'ALREADY_POSTED', status: 409 },
  ENTRY_NOT_BALANCED:     { message: 'El asiento no está balanceado (debe = haber)', code: 'NOT_BALANCED', status: 422 },
  ENTRY_EMPTY:            { message: 'El asiento no tiene importes', code: 'ENTRY_EMPTY', status: 422 },
  LINE_DEBIT_AND_CREDIT:  { message: 'Una línea no puede tener débito y crédito a la vez', code: 'LINE_DEBIT_AND_CREDIT', status: 422 },
  LINE_EMPTY:             { message: 'Una línea debe tener débito o crédito', code: 'LINE_EMPTY', status: 422 },
  ACCOUNT_NOT_FOUND:      { message: 'La cuenta indicada no existe', code: 'ACCOUNT_NOT_FOUND', status: 422 },
  ACCOUNT_NOT_POSTABLE:   { message: 'La cuenta no es imputable', code: 'ACCOUNT_NOT_POSTABLE', status: 422 },
  ACCOUNT_INACTIVE:       { message: 'La cuenta está inactiva', code: 'ACCOUNT_INACTIVE', status: 422 },
  BRANCH_NOT_FOUND:       { message: 'La sucursal indicada no existe', code: 'BRANCH_NOT_FOUND', status: 422 },
  BRANCH_NOT_ALLOWED:     { message: 'No tenés acceso a la sucursal indicada', code: 'BRANCH_NOT_ALLOWED', status: 403 },
}

/** Maps tenancy + journal-entry service errors to a structured response, or null. */
export function journalEntryErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
    return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
  }
  if (err instanceof Error) {
    const mapped = ENTRY_ERROR_MAP[err.message]
    if (mapped) {
      return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: mapped.status })
    }
  }
  return null
}
