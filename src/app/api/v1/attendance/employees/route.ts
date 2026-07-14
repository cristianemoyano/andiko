import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { employeeQuerySchema, employeeSchema } from '@/modules/attendance/employee.schema'
import { listEmployees, createEmployee } from '@/modules/attendance/employees.service'

export const GET = withTenantPermission('employees:read', async (req, _ctx, _session, ctx) => {
  try {
    const parsed = employeeQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const result = await listEmployees(parsed.data, ctx)
    return NextResponse.json(result)
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})

export const POST = withTenantPermission('employees:write', async (req, _ctx, session, ctx) => {
  try {
    const body = employeeSchema.parse(await req.json())
    const actorId = resolveActorId(session)
    const data = await createEmployee(body, ctx, actorId)
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
