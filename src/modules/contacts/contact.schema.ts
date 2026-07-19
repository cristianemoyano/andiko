import { z } from 'zod'
import { validateCuit } from './contact.utils'
import { paginationSchema } from '@/lib/pagination'
import { listSourceQuerySchema } from '@/modules/integrations/woocommerce/woo-list-filters'

export const contactSchema = z.object({
  type:          z.enum(['customer', 'supplier', 'both']),
  legal_name:    z.string().min(1).max(255),
  trade_name:    z.string().max(255).nullable().optional(),
  first_name:    z.string().max(100).nullable().optional(),
  last_name:     z.string().max(100).nullable().optional(),
  job_title:     z.string().max(120).nullable().optional(),
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

export const contactQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type:   z.enum(['customer', 'supplier', 'both']).optional(),
  source: listSourceQuerySchema,
  /** Filter to the protected system contact key (e.g. consumidor_final). */
  system_key: z.enum(['consumidor_final']).optional(),
  /** Shorthand: only system contacts when true. */
  system: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
})

export type ContactInput = z.infer<typeof contactSchema>
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>
export type ContactQuery = z.infer<typeof contactQuerySchema>
