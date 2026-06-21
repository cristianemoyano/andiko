import { z } from 'zod'
import { AFIP_CREDENTIAL_ENVIRONMENTS } from './afip-credential.model'

export const uploadCredentialsSchema = z.object({
  environment: z.enum(AFIP_CREDENTIAL_ENVIRONMENTS),
  cuit: z.string().regex(/^\d{11}$/, 'CUIT debe tener 11 dígitos'),
  cert: z.string().includes('BEGIN CERTIFICATE'),
  key: z.string().includes('PRIVATE KEY'),
  label: z.string().max(120).optional(),
})
export type UploadCredentialsBody = z.infer<typeof uploadCredentialsSchema>

export const deleteCredentialsSchema = z.object({
  environment: z.enum(AFIP_CREDENTIAL_ENVIRONMENTS),
})
