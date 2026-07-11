import { NextResponse } from 'next/server'
import { tenancyErrorResponse } from '@/lib/tenancy'
import { ScheduledTaskValidationError } from '@/modules/automations/scheduled-task.service'

const VALIDATION_ERROR_STATUS: Record<string, number> = {
  UNKNOWN_ACTION_TYPE: 422,
  INVALID_PAYLOAD: 422,
  INVALID_CRON: 422,
  SCHEDULE_TOO_FREQUENT: 422,
  MAX_ACTIVE_TASKS_REACHED: 409,
}

/** Maps automations service errors to structured API responses; rethrows if unknown. */
export function automationsErrorResponse(err: unknown): NextResponse {
  const tenancy = tenancyErrorResponse(err)
  if (tenancy) return tenancy
  if (err instanceof ScheduledTaskValidationError) {
    const status = VALIDATION_ERROR_STATUS[err.code] ?? 422
    return NextResponse.json({ error: err.message, code: err.code }, { status })
  }
  if (err instanceof Error && err.message === 'TASK_NOT_FOUND') {
    return NextResponse.json({ error: 'Automatización no encontrada', code: 'TASK_NOT_FOUND' }, { status: 404 })
  }
  throw err
}
