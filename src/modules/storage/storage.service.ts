import 'server-only'
import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import sequelize from '@/lib/db'
import logger from '@/lib/logger'
import { can } from '@/lib/permissions'
import { whereOrg } from '@/lib/tenancy'
import { paginate, toPaginated } from '@/lib/pagination'
import { getStorageAdapter, type StorageProvider } from '@/lib/storage/adapter'
import FileModel from './file.model'
import FileLink, { type FileOwnerType } from './file-link.model'
import FileShare from './file-share.model'
import { OWNER_RESOLVERS } from './owner-registry'
import { canAccessFile, type FileActor } from './storage.authz'
import type {
  InitiateUploadInput,
  ShareInput,
  OwnerLinkInput,
  FileListQuery,
} from './storage.schema'

// --- Errors (string codes, mapped to HTTP status at the route, mirroring other modules) ---
export const STORAGE_ERRORS = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_FORBIDDEN: 'FILE_FORBIDDEN',
  FILE_NOT_READY: 'FILE_NOT_READY',
  OWNER_NOT_FOUND: 'FILE_OWNER_NOT_FOUND',
  OWNER_FORBIDDEN: 'FILE_OWNER_FORBIDDEN',
  UPLOAD_NOT_FOUND: 'FILE_UPLOAD_NOT_FOUND',
  SIZE_MISMATCH: 'FILE_SIZE_MISMATCH',
} as const

/** Strips path components and unsafe characters; keeps the object key readable and S3-safe. */
function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  return base.replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'file'
}

/** Throws unless the caller may attach files to (write) the given owner record. */
async function authorizeOwnerWrite(link: OwnerLinkInput, actor: FileActor): Promise<void> {
  const resolver = OWNER_RESOLVERS[link.owner_type]
  const allowed = await can(actor.role, resolver.writePermission, actor.ctx.orgId, actor.orgRoleId)
  if (!allowed) throw new Error(STORAGE_ERRORS.OWNER_FORBIDDEN)
  if (!(await resolver.exists(link.owner_id, actor.ctx))) {
    throw new Error(STORAGE_ERRORS.OWNER_NOT_FOUND)
  }
}

async function loadFileInOrg(fileId: string, actor: FileActor) {
  const file = await FileModel.findOne({ where: whereOrg(actor.ctx, { id: fileId }) })
  if (!file) throw new Error(STORAGE_ERRORS.FILE_NOT_FOUND)
  return file
}

/**
 * Step 1 of the presigned upload: authorize the requested links, persist a `pending` file +
 * its links in one transaction, then hand back a presigned PUT for the browser to upload to.
 */
export async function initiateUpload(input: InitiateUploadInput, actor: FileActor) {
  // Every link must be writable by the caller before we mint an upload URL.
  for (const link of input.links) {
    await authorizeOwnerWrite(link, actor)
  }

  const adapter = getStorageAdapter()
  const fileId = randomUUID()
  const storageKey = `${actor.ctx.orgId}/${fileId}/${sanitizeFilename(input.filename)}`

  const file = await sequelize.transaction(async (t) => {
    const created = await FileModel.create(
      {
        id: fileId,
        storage_provider: adapter.provider,
        storage_bucket: adapter.bucket,
        storage_key: storageKey,
        original_filename: input.filename,
        content_type: input.content_type,
        byte_size: String(input.byte_size),
        checksum_sha256: input.checksum_sha256 ?? null,
        status: 'pending',
        org_id: actor.ctx.orgId,
        created_by: actor.ctx.userId,
        updated_by: actor.ctx.userId,
      },
      { transaction: t },
    )

    for (const link of input.links) {
      await FileLink.create(
        {
          file_id: fileId,
          owner_type: link.owner_type,
          owner_id: link.owner_id,
          role: link.role ?? null,
          org_id: actor.ctx.orgId,
          created_by: actor.ctx.userId,
          updated_by: actor.ctx.userId,
        },
        { transaction: t },
      )
    }

    return created
  })

  const upload = await adapter.getUploadUrl({
    key: storageKey,
    contentType: input.content_type,
    byteSize: input.byte_size,
  })

  logger.info({ fileId, actorId: actor.ctx.userId, links: input.links.length }, 'file upload initiated')

  return {
    file_id: file.id,
    upload_url: upload.url,
    method: upload.method,
    headers: upload.headers,
    expires_in: upload.expiresInSeconds,
    storage_key: storageKey,
  }
}

/**
 * Step 3 of the presigned upload: verify the object actually landed in the backend with the
 * declared size, then flip the row to `available`. Idempotent once available.
 */
export async function completeUpload(fileId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  if (file.status === 'available') return file

  const adapter = getStorageAdapter(file.storage_provider as StorageProvider)
  const head = await adapter.headObject(file.storage_key)

  if (!head) {
    await file.update({ status: 'failed', updated_by: actor.ctx.userId })
    throw new Error(STORAGE_ERRORS.UPLOAD_NOT_FOUND)
  }
  if (head.byteSize !== Number(file.byte_size)) {
    await file.update({ status: 'failed', updated_by: actor.ctx.userId })
    logger.warn(
      { fileId, declared: file.byte_size, actual: head.byteSize },
      'file upload size mismatch',
    )
    throw new Error(STORAGE_ERRORS.SIZE_MISMATCH)
  }

  await file.update({ status: 'available', uploaded_at: new Date(), updated_by: actor.ctx.userId })
  logger.info({ fileId, actorId: actor.ctx.userId }, 'file upload completed')
  return file
}

/** Mints a short-lived presigned download URL after a ReBAC read check. */
export async function getDownloadUrl(fileId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (file.status !== 'available') throw new Error(STORAGE_ERRORS.FILE_NOT_READY)
  if (!(await canAccessFile(file, actor, 'read', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }

  const adapter = getStorageAdapter(file.storage_provider as StorageProvider)
  const { url, expiresInSeconds } = await adapter.getDownloadUrl({
    key: file.storage_key,
    downloadFilename: file.original_filename,
  })
  return { url, expires_in: expiresInSeconds, filename: file.original_filename }
}

/** File metadata plus its links ("where is this linked") and explicit shares. */
export async function getFile(fileId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'read', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  const [links, shares] = await Promise.all([
    FileLink.findAll({ where: { file_id: fileId }, order: [['created_at', 'ASC']] }),
    FileShare.findAll({ where: { file_id: fileId }, order: [['created_at', 'ASC']] }),
  ])
  return { file: file.toJSON(), links: links.map((l) => l.toJSON()), shares: shares.map((s) => s.toJSON()) }
}

/**
 * Lists files. With `owner_type`+`owner_id`, returns the files attached to that record after a
 * single inherited read check (the canonical "attachments on this invoice" path). Without an
 * owner filter, returns the caller's own files (admins see all org files).
 */
export async function listFiles(query: FileListQuery, actor: FileActor) {
  const { page, limit, owner_type, owner_id } = query
  const { offset } = paginate(page, limit)

  let where: Record<string, unknown>
  if (owner_type && owner_id) {
    const resolver = OWNER_RESOLVERS[owner_type as FileOwnerType]
    const allowed = await can(actor.role, resolver.readPermission, actor.ctx.orgId, actor.orgRoleId)
    if (!allowed || !(await resolver.exists(owner_id, actor.ctx))) {
      throw new Error(STORAGE_ERRORS.OWNER_FORBIDDEN)
    }
    const links = await FileLink.findAll({
      where: whereOrg(actor.ctx, { owner_type, owner_id }),
      attributes: ['file_id'],
    })
    const fileIds = links.map((l) => l.file_id)
    where = whereOrg(actor.ctx, { id: { [Op.in]: fileIds } })
  } else if (actor.role === 'admin' || actor.role === 'sys-admin') {
    where = whereOrg(actor.ctx)
  } else {
    where = whereOrg(actor.ctx, { created_by: actor.ctx.userId })
  }

  const { rows, count } = await FileModel.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  })
  return toPaginated(rows.map((r) => r.toJSON()), count, page, limit)
}

/** Attaches an existing file to another owner record. Requires write on both file and owner. */
export async function addLink(fileId: string, input: OwnerLinkInput, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  await authorizeOwnerWrite(input, actor)

  const existing = await FileLink.findOne({
    where: { file_id: fileId, owner_type: input.owner_type, owner_id: input.owner_id },
  })
  if (existing) return existing.toJSON()

  const link = await FileLink.create({
    file_id: fileId,
    owner_type: input.owner_type,
    owner_id: input.owner_id,
    role: input.role ?? null,
    org_id: actor.ctx.orgId,
    created_by: actor.ctx.userId,
    updated_by: actor.ctx.userId,
  })
  logger.info({ fileId, owner: `${input.owner_type}:${input.owner_id}`, actorId: actor.ctx.userId }, 'file link added')
  return link.toJSON()
}

/** Detaches a file from one owner record (soft delete). */
export async function removeLink(fileId: string, linkId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  const link = await FileLink.findOne({ where: whereOrg(actor.ctx, { id: linkId, file_id: fileId }) })
  if (!link) throw new Error(STORAGE_ERRORS.FILE_NOT_FOUND)
  await link.update({ deleted_by: actor.ctx.userId })
  await link.destroy()
  logger.info({ fileId, linkId, actorId: actor.ctx.userId }, 'file link removed')
}

/** Grants an explicit share. Upserts on (file, principal) so re-sharing updates the grant. */
export async function shareFile(fileId: string, input: ShareInput, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }

  const existing = await FileShare.findOne({
    where: { file_id: fileId, principal_type: input.principal_type, principal_id: input.principal_id },
  })
  if (existing) {
    await existing.update({
      permission: input.permission,
      expires_at: input.expires_at ?? null,
      updated_by: actor.ctx.userId,
    })
    return existing.toJSON()
  }

  const share = await FileShare.create({
    file_id: fileId,
    principal_type: input.principal_type,
    principal_id: input.principal_id,
    permission: input.permission,
    expires_at: input.expires_at ?? null,
    org_id: actor.ctx.orgId,
    created_by: actor.ctx.userId,
    updated_by: actor.ctx.userId,
  })
  logger.info(
    { fileId, principal: `${input.principal_type}:${input.principal_id}`, actorId: actor.ctx.userId },
    'file shared',
  )
  return share.toJSON()
}

/** Revokes an explicit share (soft delete). */
export async function unshareFile(fileId: string, shareId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  const share = await FileShare.findOne({ where: whereOrg(actor.ctx, { id: shareId, file_id: fileId }) })
  if (!share) throw new Error(STORAGE_ERRORS.FILE_NOT_FOUND)
  await share.update({ deleted_by: actor.ctx.userId })
  await share.destroy()
  logger.info({ fileId, shareId, actorId: actor.ctx.userId }, 'file share revoked')
}

/**
 * Soft-deletes a file and its links/shares in one transaction. The backend object is retained
 * for recovery; a future background job hard-deletes orphaned objects.
 */
export async function deleteFile(fileId: string, actor: FileActor) {
  const file = await loadFileInOrg(fileId, actor)
  if (!(await canAccessFile(file, actor, 'write', fileId))) {
    throw new Error(STORAGE_ERRORS.FILE_FORBIDDEN)
  }
  await sequelize.transaction(async (t) => {
    await FileLink.update(
      { deleted_by: actor.ctx.userId },
      { where: { file_id: fileId }, transaction: t },
    )
    await FileLink.destroy({ where: { file_id: fileId }, transaction: t })
    await FileShare.update(
      { deleted_by: actor.ctx.userId },
      { where: { file_id: fileId }, transaction: t },
    )
    await FileShare.destroy({ where: { file_id: fileId }, transaction: t })
    await file.update({ deleted_by: actor.ctx.userId }, { transaction: t })
    await file.destroy({ transaction: t })
  })
  logger.info({ fileId, actorId: actor.ctx.userId }, 'file soft-deleted')
}
