import { z } from 'zod'

const assignableBuiltinRole = z.enum(['admin', 'branch-admin'])
const legacyBuiltinRole = z.enum(['admin', 'operator', 'readonly', 'branch-admin'])

export const orgUserCreateSchema = z.discriminatedUnion('roleKind', [
  z.object({
    roleKind: z.literal('builtin'),
    role: assignableBuiltinRole,
    email: z.string().email().max(255),
    name: z.string().trim().min(1).max(255),
    password: z.string().min(8).max(128),
    posPin: z.string().min(4).max(12).optional(),
    branchIds: z.array(z.string().uuid()).min(1),
    defaultBranchId: z.string().uuid(),
  }),
  z.object({
    roleKind: z.literal('custom'),
    orgRoleId: z.string().uuid(),
    email: z.string().email().max(255),
    name: z.string().trim().min(1).max(255),
    password: z.string().min(8).max(128),
    posPin: z.string().min(4).max(12).optional(),
    branchIds: z.array(z.string().uuid()).min(1),
    defaultBranchId: z.string().uuid(),
  }),
]).superRefine((data, ctx) => {
  if (!data.branchIds.includes(data.defaultBranchId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La sucursal por defecto debe estar entre las permitidas',
      path: ['defaultBranchId'],
    })
  }
  if (data.roleKind === 'builtin' && data.role === 'branch-admin' && data.branchIds.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Encargado de sucursal debe tener exactamente una sucursal',
      path: ['branchIds'],
    })
  }
})

export const orgUserUpdateSchema = z.discriminatedUnion('roleKind', [
  z.object({
    roleKind: z.literal('builtin'),
    role: legacyBuiltinRole,
    name: z.string().trim().min(1).max(255).optional(),
    branchIds: z.array(z.string().uuid()).min(1).optional(),
    defaultBranchId: z.string().uuid().optional(),
    password: z.string().min(8).max(128).optional(),
    posPin: z.string().min(4).max(12).optional(),
    is_active: z.boolean().optional(),
  }),
  z.object({
    roleKind: z.literal('custom'),
    orgRoleId: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    branchIds: z.array(z.string().uuid()).min(1).optional(),
    defaultBranchId: z.string().uuid().optional(),
    password: z.string().min(8).max(128).optional(),
    posPin: z.string().min(4).max(12).optional(),
    is_active: z.boolean().optional(),
  }),
]).superRefine((data, ctx) => {
  if (data.defaultBranchId && data.branchIds && !data.branchIds.includes(data.defaultBranchId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La sucursal por defecto debe estar entre las permitidas',
      path: ['defaultBranchId'],
    })
  }
  if (data.roleKind === 'builtin' && data.role === 'branch-admin' && data.branchIds && data.branchIds.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Encargado de sucursal debe tener exactamente una sucursal',
      path: ['branchIds'],
    })
  }
})

export type OrgUserCreateInput = z.infer<typeof orgUserCreateSchema>
export type OrgUserUpdateInput = z.infer<typeof orgUserUpdateSchema>

const orgUserCreateLegacySchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
  posPin: z.string().min(4).max(12).optional(),
  role: legacyBuiltinRole,
  branchIds: z.array(z.string().uuid()).min(1),
  defaultBranchId: z.string().uuid(),
})

const orgUserUpdateLegacySchema = z.object({
  role: legacyBuiltinRole.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  branchIds: z.array(z.string().uuid()).min(1).optional(),
  defaultBranchId: z.string().uuid().optional(),
  password: z.string().min(8).max(128).optional(),
  posPin: z.string().min(4).max(12).optional(),
  is_active: z.boolean().optional(),
})

export function parseOrgUserCreateInput(json: unknown) {
  const modern = orgUserCreateSchema.safeParse(json)
  if (modern.success) return modern
  const legacy = orgUserCreateLegacySchema.safeParse(json)
  if (legacy.success) {
    return orgUserCreateSchema.safeParse({ roleKind: 'builtin' as const, ...legacy.data })
  }
  return modern
}

export function parseOrgUserUpdateInput(json: unknown) {
  const modern = orgUserUpdateSchema.safeParse(json)
  if (modern.success) return modern
  const legacy = orgUserUpdateLegacySchema.safeParse(json)
  if (legacy.success) {
    const { role, ...rest } = legacy.data
    if (role !== undefined) {
      return orgUserUpdateSchema.safeParse({ roleKind: 'builtin' as const, role, ...rest })
    }
  }
  return modern
}
