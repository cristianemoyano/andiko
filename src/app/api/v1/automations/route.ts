import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { automationsErrorResponse } from '@/lib/automations-route-errors'
import { scheduledTaskSchema, scheduledTaskQuerySchema } from '@/modules/automations/scheduled-task.schema'
import { listScheduledTasks, createScheduledTask } from '@/modules/automations/scheduled-task.service'

export const GET = withTenantPermission('automations:read', async (req, _ctx, _session, tenant) => {
  const parsed = scheduledTaskQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const result = await listScheduledTasks(parsed.data, tenant)
    return NextResponse.json(result)
  } catch (err) {
    return automationsErrorResponse(err)
  }
})

export const POST = withTenantPermission('automations:write', async (req, _ctx, session, tenant) => {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 }) }

  const parsed = scheduledTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const task = await createScheduledTask(parsed.data, tenant, resolveActorId(session))
    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    return automationsErrorResponse(err)
  }
})
