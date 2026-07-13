import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { employeeUpdateSchema } from '@/modules/attendance/employee.schema'
import { getEmployee, updateEmployee, deleteEmployee } from '@/modules/attendance/employees.service'

export const GET = withTenantPermission<{ id: string }>('employees:read', async (_req, routeCtx, _session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const data = await getEmployee(id, ctx)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const PATCH = withTenantPermission<{ id: string }>('employees:write', async (req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const body = employeeUpdateSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await updateEmployee(id, body, ctx, actorId)
    return NextResponse.json({ data })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const DELETE = withTenantPermission<{ id: string }>('employees:delete', async (_req, routeCtx, session, ctx) => {
  const { id } = await routeCtx.params
  try {
    const actorId = resolveActorId(session)
    await deleteEmployee(id, ctx, actorId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
