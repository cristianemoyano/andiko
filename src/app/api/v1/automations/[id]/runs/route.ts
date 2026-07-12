import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { automationsErrorResponse } from '@/lib/automations-route-errors'
import { scheduledTaskRunQuerySchema } from '@/modules/automations/scheduled-task.schema'
import { listScheduledTaskRuns } from '@/modules/automations/scheduled-task.service'

export const GET = withTenantPermission<{ id: string }>('automations:read', async (req, routeCtx, _session, tenant) => {
  const { id } = await routeCtx.params
  const parsed = scheduledTaskRunQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const result = await listScheduledTaskRuns(id, tenant, parsed.data)
    if (!result) return NextResponse.json({ error: 'Automatización no encontrada', code: 'TASK_NOT_FOUND' }, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    return automationsErrorResponse(err)
  }
})
