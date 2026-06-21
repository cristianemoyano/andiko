import { z } from 'zod'

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    currentPassword: z.string().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    const hasName = data.name !== undefined
    const hasPassword = data.password !== undefined
    if (!hasName && !hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá al menos un campo para actualizar',
        path: ['name'],
      })
    }
  })

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
