import type { WhereOptions } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'

/** Blocks admin-wide attendance operations for users scoped to their own employee record. */
export function assertFullAttendanceAccess(ctx: TenantContext): void {
  if (ctx.attendanceScopeOwn) throw new Error('ATTENDANCE_SCOPE_FORBIDDEN')
}

export function whereAttendanceOwnScope(ctx: TenantContext, employeeId: string): WhereOptions {
  if (!ctx.attendanceScopeOwn) return {}
  return { employee_id: employeeId }
}
