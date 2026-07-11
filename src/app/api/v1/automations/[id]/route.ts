import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { automationsErrorResponse } from '@/lib/automations-route-errors'
import { scheduledTaskUpdateSchema } from '@/modules/automations/scheduled-task.schema'
import { getScheduledTask, updateScheduledTask, deleteScheduledTask } from '@/modules/automations/scheduled-task.service'

export const GET = withTenantPermission<{ id: string }>('automations:read', async (_req, routeCtx, _session, tenant) => {
  const { id } = await routeCtx.params
  try {
    const task = await getScheduledTask(id, tenant)
    if (!task) return NextResponse.json({ error: 'Automatización no encontrada', code: 'TASK_NOT_FOUND' }, { status: 404 })
    return NextResponse.json(task)
  } catch (err) {
    return automationsErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('automations:write', async (req, routeCtx, session, tenant) => {
  const { id } = await routeCtx.params
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = scheduledTaskUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const task = await updateScheduledTask(id, parsed.data, tenant, resolveActorId(session))
    if (!task) return NextResponse.json({ error: 'Automatización no encontrada', code: 'TASK_NOT_FOUND' }, { status: 404 })
    return NextResponse.json(task)
  } catch (err) {
    return automationsErrorResponse(err)
  }
})

export const DELETE = withTenantPermission<{ id: string }>('automations:delete', async (_req, routeCtx, session, tenant) => {
  const { id } = await routeCtx.params
  try {
    const deleted = await deleteScheduledTask(id, tenant, resolveActorId(session))
    if (!deleted) return NextResponse.json({ error: 'Automatización no encontrada', code: 'TASK_NOT_FOUND' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return automationsErrorResponse(err)
  }
})
