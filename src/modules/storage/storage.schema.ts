import { z } from 'zod'
import { env } from '@/config/env'
import { paginationSchema } from '@/lib/pagination'
import { FILE_OWNER_TYPES } from './file-link.model'
import { SHARE_PRINCIPAL_TYPES, SHARE_PERMISSIONS } from './file-share.model'

/** Content types accepted for upload. Anything else is rejected before a presigned URL is issued. */
export const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
] as const

export const ownerLinkSchema = z.object({
  owner_type: z.enum(FILE_OWNER_TYPES),
  owner_id: z.string().uuid(),
  role: z.string().max(64).nullable().optional(),
})

export const initiateUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.enum(ALLOWED_CONTENT_TYPES),
  byte_size: z.coerce
    .number()
    .int()
    .positive()
    .max(env.FILE_MAX_BYTES, `El archivo supera el máximo de ${env.FILE_MAX_BYTES} bytes`),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
  // At least one owner link required — prevents orphan uploads that only the creator can see
  // but still consume org storage.
  links: z.array(ownerLinkSchema).min(1, 'Debe vincular el archivo a al menos un registro'),
})

export const shareSchema = z.object({
  principal_type: z.enum(SHARE_PRINCIPAL_TYPES),
  principal_id: z.string().uuid(),
  permission: z.enum(SHARE_PERMISSIONS).default('read'),
  expires_at: z.coerce.date().nullable().optional(),
})

export const fileListQuerySchema = paginationSchema.extend({
  owner_type: z.enum(FILE_OWNER_TYPES).optional(),
  owner_id: z.string().uuid().optional(),
})

export type OwnerLinkInput = z.infer<typeof ownerLinkSchema>
export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>
export type ShareInput = z.infer<typeof shareSchema>
export type FileListQuery = z.infer<typeof fileListQuerySchema>
