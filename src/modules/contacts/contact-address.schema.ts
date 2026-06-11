import { z } from 'zod'

export const contactAddressSchema = z.object({
  type:        z.enum(['fiscal', 'delivery', 'commercial']),
  street:      z.string().min(1).max(255),
  number:      z.string().max(20).nullable().optional(),
  floor:       z.string().max(20).nullable().optional(),
  apartment:   z.string().max(20).nullable().optional(),
  city:        z.string().min(1).max(100),
  province:    z.string().min(1).max(100),
  postal_code: z.string().max(10).nullable().optional(),
  country:     z.string().max(100).default('Argentina'),
  is_default:  z.boolean().default(false),
})

export const contactAddressUpdateSchema = contactAddressSchema.partial()

export type ContactAddressInput = z.infer<typeof contactAddressSchema>
export type ContactAddressUpdateInput = z.infer<typeof contactAddressUpdateSchema>
