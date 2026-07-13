import { NextResponse } from 'next/server'
import { tenancyErrorResponse } from '@/lib/tenancy'

const ATTENDANCE_ERROR_RESPONSES: Record<string, { status: number; message: string }> = {
  EMPLOYEE_NOT_FOUND:          { status: 404, message: 'Empleado no encontrado' },
  EMPLOYEE_NOT_LINKED:         { status: 404, message: 'Tu usuario no tiene un legajo de empleado vinculado' },
  EMPLOYEE_USER_ALREADY_LINKED: { status: 409, message: 'Ese usuario ya está vinculado a otro empleado' },
  EMPLOYEE_CUIL_ALREADY_USED:  { status: 409, message: 'Ya existe un empleado con ese CUIL' },
  EMPLOYEE_CODE_ALREADY_USED:  { status: 409, message: 'Ya existe un empleado con ese código de legajo' },
  ATTENDANCE_EVENT_NOT_FOUND:  { status: 404, message: 'Registro de fichaje no encontrado' },
  ALREADY_CLOCKED_IN:          { status: 409, message: 'Ya registraste una entrada sin salida' },
  NOT_CLOCKED_IN:              { status: 409, message: 'No hay una entrada abierta para registrar la salida' },
  INVALID_SESSION_RANGE:       { status: 422, message: 'La salida debe ser posterior a la entrada' },
  ATTENDANCE_SCOPE_FORBIDDEN:  { status: 403, message: 'No tenés permiso para gestionar fichajes de otros empleados' },
}

/** Mapea errores de servicios de asistencia/RRHH a respuestas estructuradas; rethrow si es desconocido. */
export function attendanceErrorResponse(err: unknown): NextResponse {
  const tenancy = tenancyErrorResponse(err)
  if (tenancy) return tenancy
  if (!(err instanceof Error)) throw err
  if (err.message === 'ATTENDANCE_IMPORT_ROW_ERRORS') {
    const importErrors = (err as Error & { importErrors: unknown[] }).importErrors
    return NextResponse.json({ created: 0, skipped: 0, errors: importErrors }, { status: 422 })
  }
  const hit = ATTENDANCE_ERROR_RESPONSES[err.message]
  if (!hit) throw err
  return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
}
