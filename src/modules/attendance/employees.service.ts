import 'server-only'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import Employee from './employee.model'
import Branch from '@/modules/auth/branch.model'
import User from '@/modules/auth/user.model'
import {
  employeeSchema,
  employeeUpdateSchema,
  type EmployeeInput,
  type EmployeeUpdateInput,
  type EmployeeQuery,
} from './employee.schema'
import {
  normalizeEmployeeImportRow,
  rowToEmployeeInput,
  rowToEmployeeUpdateInput,
} from './employees-csv-adapter'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg, whereAllowedBranches, whereAllowedBranchRecords, whereBranch } from '@/lib/tenancy'

async function assertNoConflicts(
  input: Partial<EmployeeInput>,
  ctx: TenantContext,
  excludeId?: string,
  transaction?: import('sequelize').Transaction,
) {
  const tx = transaction ? { transaction } : {}
  if (input.cuil) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, { cuil: input.cuil, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) }),
      ...tx,
    })
    if (existing) throw new Error('EMPLOYEE_CUIL_ALREADY_USED')
  }
  if (input.external_employee_code) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, {
        external_employee_code: input.external_employee_code,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      }),
      ...tx,
    })
    if (existing) throw new Error('EMPLOYEE_CODE_ALREADY_USED')
  }
  if (input.user_id) {
    const existing = await Employee.findOne({
      where: whereOrg(ctx, { user_id: input.user_id, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) }),
      ...tx,
    })
    if (existing) throw new Error('EMPLOYEE_USER_ALREADY_LINKED')
  }
}

const IMPORT_CONFLICT_MESSAGES: Record<string, string> = {
  EMPLOYEE_CUIL_ALREADY_USED: 'Ya existe un empleado con ese CUIL',
  EMPLOYEE_CODE_ALREADY_USED: 'Ya existe un empleado con ese código de legajo',
  EMPLOYEE_USER_ALREADY_LINKED: 'Ese usuario ya está vinculado a otro empleado',
}

function importConflictMessage(err: unknown): string {
  if (err instanceof Error && IMPORT_CONFLICT_MESSAGES[err.message]) {
    return IMPORT_CONFLICT_MESSAGES[err.message]
  }
  return err instanceof Error ? err.message : 'Conflicto al importar'
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

export type EmployeeImportAction = 'create' | 'update' | 'upsert'

export type EmployeeImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

function resolveBranchIdFromCode(
  rawCode: string,
  codeToBranchId: Map<string, string>,
): string | null {
  const trimmed = rawCode.trim()
  if (!trimmed) return null
  if (codeToBranchId.has(trimmed)) return codeToBranchId.get(trimmed) ?? null
  const asNum = Number(trimmed)
  if (Number.isFinite(asNum)) {
    return codeToBranchId.get(String(asNum)) ?? null
  }
  return null
}

async function findEmployeeForImport(
  row: { external_employee_code: string | null; cuil: string | null },
  ctx: TenantContext,
  transaction: import('sequelize').Transaction,
) {
  if (row.external_employee_code) {
    const byCode = await Employee.findOne({
      where: whereOrg(ctx, { external_employee_code: row.external_employee_code }),
      transaction,
    })
    if (byCode) return byCode
  }
  if (row.cuil) {
    return Employee.findOne({
      where: whereOrg(ctx, { cuil: row.cuil }),
      transaction,
    })
  }
  return null
}

export async function importEmployees(
  rows: Record<string, string>[],
  action: EmployeeImportAction,
  ctx: TenantContext,
  actorId: string,
): Promise<EmployeeImportResult> {
  const errors: EmployeeImportResult['errors'] = []
  let created = 0
  let updated = 0
  let skipped = 0

  const branches = await Branch.findAll({
    where: whereAllowedBranchRecords(ctx, { is_active: true }),
    attributes: ['id', 'branch_code'],
  })
  const codeToBranchId = new Map<string, string>()
  for (const b of branches) {
    codeToBranchId.set(String(b.branch_code), b.id)
  }

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2
      const mapped = normalizeEmployeeImportRow(rows[i])

      if (mapped.standard_weekly_minutes === undefined) {
        errors.push({ row: rowNum, message: `Horas semanales inválidas: "${rows[i].weekly_hours ?? ''}"` })
        continue
      }
      if (mapped.termination_date === undefined) {
        errors.push({ row: rowNum, message: `Fecha de egreso inválida: "${rows[i].termination_date ?? ''}"` })
        continue
      }
      if (rows[i].employment_type?.trim() && mapped.employment_type === undefined) {
        errors.push({
          row: rowNum,
          message: `Tipo de jornada inválido: "${rows[i].employment_type}". Usá: mensualizado, jornalizado, por_hora`,
        })
        continue
      }
      if (rows[i].is_active?.trim() && mapped.is_active === undefined) {
        errors.push({ row: rowNum, message: `Valor de Activo inválido: "${rows[i].is_active}"` })
        continue
      }

      const branchId = resolveBranchIdFromCode(mapped.branch_code, codeToBranchId)
      if ((action === 'create' || action === 'upsert') && !branchId) {
        errors.push({
          row: rowNum,
          message: `Código de sucursal no reconocido: "${mapped.branch_code}"`,
        })
        continue
      }
      if (action === 'update' && mapped.branch_code && !branchId) {
        errors.push({
          row: rowNum,
          message: `Código de sucursal no reconocido: "${mapped.branch_code}"`,
        })
        continue
      }

      if (action === 'create' || action === 'upsert') {
        if (!branchId) continue
        const input = rowToEmployeeInput(mapped, branchId)
        const parsed = employeeSchema.safeParse(input)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          continue
        }
      } else {
        const input = rowToEmployeeUpdateInput(mapped, branchId ?? undefined)
        const parsed = employeeUpdateSchema.safeParse(input)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          continue
        }
        if (!mapped.external_employee_code && !mapped.cuil) {
          errors.push({
            row: rowNum,
            message: 'Para actualizar se necesita Código de legajo o CUIL',
          })
          continue
        }
      }

      const existing = await findEmployeeForImport(mapped, ctx, t)

      if (action === 'create') {
        if (existing) { skipped++; continue }
        if (!branchId) continue
        const input = employeeSchema.parse(rowToEmployeeInput(mapped, branchId))
        try {
          await assertNoConflicts(input, ctx, undefined, t)
        } catch (err) {
          errors.push({ row: rowNum, message: importConflictMessage(err) })
          continue
        }
        await Employee.create({
          ...input,
          org_id: ctx.orgId,
          created_by: actorId,
          updated_by: actorId,
        }, { transaction: t })
        created++
      } else if (action === 'update') {
        if (!existing) { skipped++; continue }
        const input = employeeUpdateSchema.parse(rowToEmployeeUpdateInput(mapped, branchId ?? undefined))
        try {
          await assertNoConflicts(input, ctx, existing.id, t)
        } catch (err) {
          errors.push({ row: rowNum, message: importConflictMessage(err) })
          continue
        }
        await existing.update({ ...input, updated_by: actorId }, { transaction: t })
        updated++
      } else {
        if (!branchId) continue
        const input = employeeSchema.parse(rowToEmployeeInput(mapped, branchId))
        if (existing) {
          try {
            await assertNoConflicts(input, ctx, existing.id, t)
          } catch (err) {
            errors.push({ row: rowNum, message: importConflictMessage(err) })
            continue
          }
          await existing.update({ ...input, updated_by: actorId }, { transaction: t })
          updated++
        } else {
          try {
            await assertNoConflicts(input, ctx, undefined, t)
          } catch (err) {
            errors.push({ row: rowNum, message: importConflictMessage(err) })
            continue
          }
          await Employee.create({
            ...input,
            org_id: ctx.orgId,
            created_by: actorId,
            updated_by: actorId,
          }, { transaction: t })
          created++
        }
      }
    }

    if (errors.length > 0) {
      throw Object.assign(new Error('IMPORT_VALIDATION_ERRORS'), { importErrors: errors })
    }
  })

  logger.info({ created, updated, skipped, actorId }, 'employees imported')
  return { created, updated, skipped, errors: [] }
}
