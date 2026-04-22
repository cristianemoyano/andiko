import { z } from 'zod'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(slugPattern, 'Solo minúsculas, números y guiones')
    .optional(),
})

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(slugPattern, 'Solo minúsculas, números y guiones')
    .optional(),
  is_active: z.boolean().optional(),
})

export const branchCreateSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).nullable().optional(),
})

export const branchUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
})

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>
export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
