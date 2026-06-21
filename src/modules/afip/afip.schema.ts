import { z } from 'zod'
import { validateCuit } from '@/modules/contacts/contact.utils'
import { ORG_IVA_CONDITIONS } from '@/modules/auth/organization.model'
import { AFIP_ENVIRONMENTS } from './afip-codes'

export const afipOrgFiscalSchema = z.object({
  legal_name: z.string().min(1, 'Ingresá la razón social').max(255),
  cuit: z
    .string()
    .regex(/^\d{2}-\d{8}-\d$/, 'Formato: XX-XXXXXXXX-X')
    .refine(validateCuit, 'CUIT inválido (dígito verificador)'),
  iva_condition: z.enum(ORG_IVA_CONDITIONS),
  fiscal_address: z.string().max(500).nullable().optional(),
  gross_income: z.string().max(32).nullable().optional(),
  activity_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: AAAA-MM-DD').nullable().optional(),
})
export type AfipOrgFiscalInput = z.infer<typeof afipOrgFiscalSchema>

export const libroIvaQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.from <= v.to, { message: 'from must be on or before to', path: ['from'] })
export type LibroIvaQuery = z.infer<typeof libroIvaQuerySchema>

export const afipConfigBranchSchema = z.object({
  branch_id: z.string().uuid(),
  punto_venta: z.number().int().positive().max(99999),
  establishment_code: z.string().max(64).nullable().optional(),
})

export const afipConfigSchema = z.object({
  branches: z.array(afipConfigBranchSchema).min(1),
})
export type AfipConfigInput = z.infer<typeof afipConfigSchema>

export const afipEnvironmentSchema = z.object({
  environment: z.enum(AFIP_ENVIRONMENTS),
})
