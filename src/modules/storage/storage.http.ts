import 'server-only'
import { NextResponse } from 'next/server'
import type { AuthedSession } from '@/lib/api-handler'
import type { TenantContext } from '@/lib/tenancy'
import type { FileActor } from './storage.authz'
import { STORAGE_ERRORS } from './storage.service'

/** Builds the ReBAC actor from the authenticated session + resolved tenant context. */
export function buildFileActor(session: AuthedSession, ctx: TenantContext): FileActor {
  return {
    ctx,
    role: session.user.role,
    orgRoleId: session.user.orgRoleId ?? null,
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  [STORAGE_ERRORS.FILE_NOT_FOUND]: 404,
  [STORAGE_ERRORS.OWNER_NOT_FOUND]: 404,
  [STORAGE_ERRORS.FILE_FORBIDDEN]: 403,
  [STORAGE_ERRORS.OWNER_FORBIDDEN]: 403,
  [STORAGE_ERRORS.FILE_NOT_READY]: 409,
  [STORAGE_ERRORS.UPLOAD_NOT_FOUND]: 409,
  [STORAGE_ERRORS.SIZE_MISMATCH]: 409,
  [STORAGE_ERRORS.STORAGE_NOT_CONFIGURED]: 503,
}

/** Maps a storage service error to a structured response, or null when unrecognized (rethrow). */
export function storageErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof Error)) return null
  const status = STATUS_BY_CODE[err.message]
  if (!status) return null
  return NextResponse.json({ error: err.message, code: err.message }, { status })
}
