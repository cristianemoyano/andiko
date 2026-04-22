import { z } from 'zod'

const orgTenantRole = z.enum(['admin', 'operator', 'readonly'])

export const orgUserCreateSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(255),
  password: z.string().min(8).max(128),
  role: orgTenantRole,
  branchIds: z.array(z.string().uuid()).min(1, 'Elegí al menos una sucursal'),
  defaultBranchId: z.string().uuid(),
}).refine(
  (d) => d.branchIds.includes(d.defaultBranchId),
  { message: 'La sucursal por defecto debe estar entre las permitidas', path: ['defaultBranchId'] },
)

export const orgUserUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    role: orgTenantRole.optional(),
    branchIds: z.array(z.string().uuid()).min(1).optional(),
    defaultBranchId: z.string().uuid().optional(),
    password: z.string().min(8).max(128).optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (d) => {
      if (d.defaultBranchId && d.branchIds && !d.branchIds.includes(d.defaultBranchId)) {
        return false
      }
      return true
    },
    { message: 'La sucursal por defecto debe estar entre las permitidas', path: ['defaultBranchId'] },
  )

export type OrgUserCreateInput = z.infer<typeof orgUserCreateSchema>
export type OrgUserUpdateInput = z.infer<typeof orgUserUpdateSchema>
