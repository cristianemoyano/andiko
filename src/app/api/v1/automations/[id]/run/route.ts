import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { automationsErrorResponse } from '@/lib/automations-route-errors'
import { runScheduledTaskNow } from '@/modules/automations/scheduled-task-runner.service'

export const POST = withTenantPermission<{ id: string }>('automations:write', async (_req, routeCtx, _session, tenant) => {
  const { id } = await routeCtx.params
  try {
    const result = await runScheduledTaskNow(id, tenant.orgId)
    return NextResponse.json(result)
  } catch (err) {
    return automationsErrorResponse(err)
  }
})
