import { z } from 'zod'

export const termsAndConditionsUpdateSchema = z.object({
  terms_and_conditions: z.string().max(20000).nullable(),
})

export type TermsAndConditionsUpdateInput = z.infer<typeof termsAndConditionsUpdateSchema>
