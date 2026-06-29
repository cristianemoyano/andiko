import { fetchJson } from '@/lib/fetch-json'

/**
 * Browser-side helpers for the file service. These are the default implementations the file
 * components use; components accept them as injectable props so Storybook can pass fakes and
 * render every state offline.
 *
 * Note: `DEFAULT_ALLOWED_CONTENT_TYPES` mirrors `ALLOWED_CONTENT_TYPES` in
 * `src/modules/storage/storage.schema.ts`. It is duplicated here on purpose — that module is
 * `server-only` (pulls in env) and must not be imported into client bundles. The server remains
 * the source of truth; this list is just for fast client-side UX validation.
 */
export const DEFAULT_ALLOWED_CONTENT_TYPES = [
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

export type FileOwnerType =
  | 'invoice'
  | 'product'
  | 'contact'
  | 'supplier_invoice'
  | 'purchase_receipt'
export type SharePrincipalType = 'user' | 'org_role' | 'branch'
export type SharePermission = 'read' | 'write'
export type FileStatus = 'pending' | 'available' | 'failed'

export const FILE_OWNER_TYPE_LABELS: Record<FileOwnerType, string> = {
  invoice: 'Factura de venta',
  product: 'Producto',
  contact: 'Contacto',
  supplier_invoice: 'Factura de proveedor',
  purchase_receipt: 'Recepción de compra',
}

export interface OwnerLink {
  owner_type: FileOwnerType
  owner_id: string
  role?: string | null
}

export interface FileMetadata {
  id: string
  original_filename: string
  content_type: string
  byte_size: string
  status: FileStatus
  uploaded_at: string | null
  created_at: string
}

export interface SharedFileListItem extends FileMetadata {
  share_permission: SharePermission
  shared_at: string
  owner_links: Array<{ owner_type: FileOwnerType; owner_id: string }>
}

export interface FileShare {
  id: string
  principal_type: SharePrincipalType
  principal_id: string
  permission: SharePermission
  expires_at: string | null
  created_at: string
}

export interface ShareInput {
  principal_type: SharePrincipalType
  principal_id: string
  permission: SharePermission
  expires_at?: string | null
}

export interface SharePrincipalOption {
  id: string
  label: string
}

export interface SharePrincipalOptions {
  users: SharePrincipalOption[]
  org_roles: SharePrincipalOption[]
  branches: SharePrincipalOption[]
}

interface InitiateResponse {
  file_id: string
  upload_url: string
  method: 'PUT'
  headers: Record<string, string>
  expires_in: number
}

/** Function signatures the components depend on (so stories can inject fakes). */
export type UploadFileFn = (file: File, opts?: { links?: OwnerLink[] }) => Promise<FileMetadata>
export type GetDownloadUrlFn = (fileId: string) => Promise<{ url: string; filename: string }>
export type ListSharesFn = (fileId: string) => Promise<FileShare[]>
export type AddShareFn = (fileId: string, input: ShareInput) => Promise<FileShare>
export type RevokeShareFn = (fileId: string, shareId: string) => Promise<void>
export type DeleteFileFn = (fileId: string) => Promise<void>
export type FetchSharePrincipalsFn = () => Promise<SharePrincipalOptions>
export type ListSharedWithMeFn = (params?: { page?: number; limit?: number }) => Promise<{
  data: SharedFileListItem[]
  total: number
  page: number
  limit: number
}>

/** Runs the 3-step presigned upload: initiate → PUT bytes → complete. */
export const uploadFile: UploadFileFn = async (file, opts) => {
  if (!opts?.links?.length) {
    throw new Error('Debe vincular el archivo a al menos un registro')
  }
  if (!file.type) {
    throw new Error('No se pudo detectar el tipo de archivo')
  }

  const initiated = await fetchJson<InitiateResponse>('/api/v1/files', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type,
      byte_size: file.size,
      links: opts.links,
    }),
  })

  const put = await fetch(initiated.upload_url, {
    method: initiated.method,
    headers: initiated.headers,
    body: file,
  })
  if (!put.ok) {
    throw new Error(`La subida al almacenamiento falló (HTTP ${put.status})`)
  }

  return fetchJson<FileMetadata>(`/api/v1/files/${initiated.file_id}/complete`, { method: 'POST' })
}

export const getFileDownloadUrl: GetDownloadUrlFn = (fileId) =>
  fetchJson<{ url: string; expires_in: number; filename: string }>(`/api/v1/files/${fileId}/download`).then(
    (r) => ({ url: r.url, filename: r.filename }),
  )

/** Same-origin inline stream for PDF/image preview (session cookie auth). */
export function getFileContentUrl(fileId: string): string {
  return `/api/v1/files/${encodeURIComponent(fileId)}/content`
}

export const listFileShares: ListSharesFn = (fileId) =>
  fetchJson<{ data: FileShare[] }>(`/api/v1/files/${fileId}/shares`).then((r) => r.data)

export const fetchSharePrincipals: FetchSharePrincipalsFn = () =>
  fetchJson<{ data: SharePrincipalOptions }>('/api/v1/files/share-principals').then((r) => r.data)

export const listSharedWithMeFiles: ListSharedWithMeFn = (params) => {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()
  return fetchJson<{ data: SharedFileListItem[]; total: number; page: number; limit: number }>(
    `/api/v1/files/shared-with-me${qs ? `?${qs}` : ''}`,
  )
}

export const addFileShare: AddShareFn = (fileId, input) =>
  fetchJson<FileShare>(`/api/v1/files/${fileId}/shares`, { method: 'POST', body: JSON.stringify(input) })

export const revokeFileShare: RevokeShareFn = async (fileId, shareId) => {
  await fetchJson<void>(`/api/v1/files/${fileId}/shares/${shareId}`, { method: 'DELETE' })
}

export const deleteFile: DeleteFileFn = async (fileId) => {
  await fetchJson<void>(`/api/v1/files/${fileId}`, { method: 'DELETE' })
}
