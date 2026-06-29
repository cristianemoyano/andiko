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

export const organizationUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    is_active: z.boolean().optional(),
    ...fiscalFields,
  })
  .strict()

const branchAddressFields = {
  street:      z.string().max(255).nullable().optional(),
  number:      z.string().max(20).nullable().optional(),
  floor:       z.string().max(20).nullable().optional(),
  apartment:   z.string().max(20).nullable().optional(),
  city:        z.string().max(100).nullable().optional(),
  province:    z.string().max(100).nullable().optional(),
  postal_code: z.string().max(10).nullable().optional(),
  country:     z.string().max(100).nullable().optional(),
}

export const branchCreateSchema = z.object({
  name: z.string().min(1).max(255),
  // Legacy free-text address; kept for back-compat. New clients send structured fields.
  address: z.string().max(500).nullable().optional(),
  ...branchAddressFields,
})

export const branchUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
  ...branchAddressFields,
})

export const organizationSettingsUpdateSchema = z.object({
  enabled_modules: z.array(z.enum(ORG_MODULE_KEYS)).optional(),
  enabled_features: z.record(z.string(), z.boolean()).optional(),
})

export const organizationFiscalUpdateSchema = z
  .object({
    legal_name: z.string().min(1).max(255).nullable().optional(),
    cuit: cuitSchema.nullable().optional(),
    iva_condition: z.enum(ORG_IVA_CONDITIONS).nullable().optional(),
    fiscal_address: z.string().min(1).max(500).nullable().optional(),
  })
  .strict()

export type OrganizationFiscalUpdateInput = z.infer<typeof organizationFiscalUpdateSchema>

export type OrganizationSettingsUpdateInput = z.infer<typeof organizationSettingsUpdateSchema>
export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>
export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
