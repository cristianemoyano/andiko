import 'server-only'
import { Op } from 'sequelize'
import Employee from './employee.model'
import User from '@/modules/auth/user.model'
import type { EmployeeInput, EmployeeUpdateInput, EmployeeQuery } from './employee.schema'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg, whereAllowedBranches, whereBranch } from '@/lib/tenancy'

async function assertNoConflicts(
  input: Partial<EmployeeInput>,
  ctx: TenantContext,
  excludeId?: string,
) {
  if (input.cuil) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, { cuil: input.cuil, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) }),
    })
    if (existing) throw new Error('EMPLOYEE_CUIL_ALREADY_USED')
  }
  if (input.external_employee_code) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, {
        external_employee_code: input.external_employee_code,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      }),
    })
    if (existing) throw new Error('EMPLOYEE_CODE_ALREADY_USED')
  }
  if (input.user_id) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, { user_id: input.user_id, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) }),
    })
    if (existing) throw new Error('EMPLOYEE_USER_ALREADY_LINKED')
  }
}

export async function listEmployees(query: EmployeeQuery, ctx: TenantContext) {
  const { page, limit, search, branch_id, is_active } = query
  const { offset } = paginate(page, limit)

  const where = whereAllowedBranches(ctx, {
    ...(branch_id ? { branch_id } : {}),
    ...(is_active !== undefined ? { is_active } : {}),
    ...(search
      ? {
          [Op.or]: [
            { first_name: { [Op.iLike]: `%${search}%` } },
            { last_name: { [Op.iLike]: `%${search}%` } },
            { cuil: { [Op.iLike]: `%${search}%` } },
            { external_employee_code: { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {}),
  })

  const { rows, count } = await Employee.findAndCountAll({
    where,
    limit,
    offset,
    order: [['last_name', 'ASC'], ['first_name', 'ASC']],
  })

  return toPaginated(rows, count, page, limit)
}

export async function getEmployee(id: string, ctx: TenantContext) {
  const employee = await Employee.findOne({ where: whereAllowedBranches(ctx, { id }) })
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND')
  return employee
}

export async function getMyEmployee(ctx: TenantContext) {
  const employee = await Employee.findOne({ where: whereOrg(ctx, { user_id: ctx.userId }) })
  if (!employee) throw new Error('EMPLOYEE_NOT_LINKED')
  return employee
}

export async function createEmployee(input: EmployeeInput, ctx: TenantContext, actorId: string) {
  await assertNoConflicts(input, ctx)
  void whereBranch(ctx, input.branch_id)
  const employee = await Employee.create({
    ...input,
    org_id: ctx.orgId,
    created_by: actorId,
    updated_by: actorId,
  })
  logger.info({ employeeId: employee.id, actorId }, 'employee created')
  return employee
}

export async function updateEmployee(id: string, input: EmployeeUpdateInput, ctx: TenantContext, actorId: string) {
  const employee = await getEmployee(id, ctx)
  await assertNoConflicts(input, ctx, id)
  if (input.branch_id) void whereBranch(ctx, input.branch_id)
  await employee.update({
    ...input,
    updated_by: actorId,
  })
  logger.info({ employeeId: id, actorId }, 'employee updated')
  return employee
}

/** Usuarios de la org que pueden vincularse a un legajo de empleado (para el selector del formulario). */
export async function listLinkableUsers(ctx: TenantContext) {
  const rows = await User.findAll({
    where: {
      org_id: ctx.orgId,
      is_active: true,
      role: { [Op.ne]: 'sys-admin' },
    },
    attributes: ['id', 'name', 'email'],
    order: [['name', 'ASC']],
    limit: 200,
  })
  return rows.map(r => r.get({ plain: true }))
}

export async function deleteEmployee(id: string, ctx: TenantContext, actorId: string) {
  const employee = await getEmployee(id, ctx)
  await employee.update({ deleted_by: actorId })
  await employee.destroy()
  logger.info({ employeeId: id, actorId }, 'employee soft-deleted')
}
