import { z } from 'zod'
import { validateCuit } from '@/modules/contacts/contact.utils'
import { ORG_IVA_CONDITIONS } from '@/modules/auth/organization.model'
import { ORG_MODULE_KEYS } from '@/modules/auth/organization-modules'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const cuitSchema = z
  .string()
  .regex(/^\d{2}-\d{8}-\d$/, 'Formato: XX-XXXXXXXX-X')
  .refine(validateCuit, 'CUIT inválido (dígito verificador)')

const fiscalFields = {
  legal_name: z.string().min(1).max(255).nullable().optional(),
  cuit: cuitSchema.nullable().optional(),
  iva_condition: z.enum(ORG_IVA_CONDITIONS).nullable().optional(),
  fiscal_address: z.string().min(1).max(500).nullable().optional(),
}

export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(slugPattern, 'Solo minúsculas, números y guiones')
    .optional(),
  ...fiscalFields,
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
  ...fiscalFields,
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

export const organizationSettingsUpdateSchema = z.object({
  enabled_modules: z.array(z.enum(ORG_MODULE_KEYS)).optional(),
  enabled_features: z.record(z.string(), z.boolean()).optional(),
})

export type OrganizationSettingsUpdateInput = z.infer<typeof organizationSettingsUpdateSchema>
export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>
export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
