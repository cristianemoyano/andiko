import 'server-only'
import Organization from '@/modules/auth/organization.model'
import type { TenantContext } from '@/lib/tenancy'
import type { FileOwnerType } from './file-link.model'
import type { OwnerLinkInput } from './storage.schema'
import { OWNER_RESOLVERS } from './owner-registry'

/** Argentina business date for upload folder partitioning. */
const UPLOAD_TIMEZONE = 'America/Argentina/Buenos_Aires'

const MAX_SEGMENT_LEN = 64

export const OWNER_PATH_SEGMENTS: Record<FileOwnerType, { module: string; entity: string }> = {
  supplier_invoice: { module: 'compras', entity: 'facturas-proveedor' },
  purchase_receipt: { module: 'compras', entity: 'recepciones' },
  invoice: { module: 'ventas', entity: 'facturas' },
  product: { module: 'catalogo', entity: 'productos' },
  contact: { module: 'contactos', entity: 'contactos' },
}

export type BuildStorageKeyInput = {
  orgId: string
  fileId: string
  filename: string
  /** First link drives the storage path when multiple owners are attached. */
  primaryLink: OwnerLinkInput
  ctx: TenantContext
  uploadedAt?: Date
}

/**
 * Human-readable object key for S3/Dropbox/GDrive.
 *
 * Template:
 * `{orgSlug}/suc-{branchCode|org}/{module}/{entity}/{yyyy}/{mm}/{dd}/{docRef}__{fileId8}__{filename}`
 *
 * `orgSlug` and `branch_code` are immutable identifiers (see org/branch create flows).
 * The key is frozen in `files.storage_key` at upload time.
 */
export async function buildStorageKey(input: BuildStorageKeyInput): Promise<string> {
  const org = await Organization.findByPk(input.orgId, { attributes: ['slug'] })
  if (!org) throw new Error('ORG_NOT_FOUND')

  const uploadedAt = input.uploadedAt ?? new Date()
  const { yyyy, mm, dd } = formatUploadDateParts(uploadedAt)
  const segments = OWNER_PATH_SEGMENTS[input.primaryLink.owner_type]
  const pathCtx = await OWNER_RESOLVERS[input.primaryLink.owner_type].pathContext(
    input.primaryLink.owner_id,
    input.ctx,
  )

  const branchSegment = pathCtx.branchCode != null
    ? `suc-${String(pathCtx.branchCode).padStart(3, '0')}`
    : 'org'

  const docRef = pathCtx.documentRef
    ? sanitizePathSegment(pathCtx.documentRef)
    : shortOwnerId(input.primaryLink.owner_id)

  const fileIdShort = input.fileId.split('-')[0] ?? input.fileId.slice(0, 8)
  const leaf = `${docRef}__${fileIdShort}__${sanitizeStorageFilename(input.filename)}`

  return [
    sanitizePathSegment(org.slug),
    branchSegment,
    segments.module,
    segments.entity,
    yyyy,
    mm,
    dd,
    leaf,
  ].join('/')
}

/** Path segment: lowercase, safe chars, max length. */
export function sanitizePathSegment(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')

  const out = cleaned.slice(0, MAX_SEGMENT_LEN)
  return out || 'unknown'
}

/** Filename leaf — strips path components and unsafe characters. */
export function sanitizeStorageFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  return base.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 200) || 'file'
}

export function shortOwnerId(ownerId: string): string {
  return ownerId.replace(/-/g, '').slice(0, 8).toLowerCase()
}

function formatUploadDateParts(d: Date): { yyyy: string; mm: string; dd: string } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: UPLOAD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  const [yyyy, mm, dd] = iso.split('-')
  return { yyyy: yyyy ?? '0000', mm: mm ?? '01', dd: dd ?? '01' }
}
