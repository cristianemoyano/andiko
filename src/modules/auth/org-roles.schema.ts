import { z } from 'zod'
import { ASSIGNABLE_MATRIX_PERMISSIONS } from '@/lib/permissions'

export const orgRoleCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
  allows_pos: z.boolean().optional(),
})

export const orgRoleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(255).nullable().optional(),
  allows_pos: z.boolean().optional(),
})

export const orgRoleMatrixUpdateSchema = z.object({
  updates: z.array(
    z.object({
      orgRoleId: z.string().uuid(),
      permissionNames: z.array(z.string()).refine(
        names => names.every(n => (ASSIGNABLE_MATRIX_PERMISSIONS as readonly string[]).includes(n)),
        'Permiso no asignable',
      ),
    }),
  ).min(1),
})

export type OrgRoleCreateInput = z.infer<typeof orgRoleCreateSchema>
export type OrgRoleUpdateInput = z.infer<typeof orgRoleUpdateSchema>
export type OrgRoleMatrixUpdateInput = z.infer<typeof orgRoleMatrixUpdateSchema>
