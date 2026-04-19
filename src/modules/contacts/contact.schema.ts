import { z } from 'zod'
import { validateCuit } from './contact.utils'

export const contactSchema = z.object({
  type:          z.enum(['customer', 'supplier', 'both']),
  legal_name:    z.string().min(1).max(255),
  trade_name:    z.string().max(255).nullable().optional(),
  cuit:          z.string()
                  .regex(/^\d{2}-\d{8}-\d$/, 'Formato: XX-XXXXXXXX-X')
                  .refine(validateCuit, 'CUIT inválido')
                  .nullable()
                  .optional(),
  iva_condition: z.enum(['responsable_inscripto', 'monotributista', 'consumidor_final', 'exento', 'no_responsable']),
  email:         z.string().email().nullable().optional(),
  phone:         z.string().max(50).nullable().optional(),
  notes:         z.string().nullable().optional(),
})

export const contactUpdateSchema = contactSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const contactQuerySchema = z.object({
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  type:   z.enum(['customer', 'supplier', 'both']).optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>
export type ContactQuery = z.infer<typeof contactQuerySchema>
