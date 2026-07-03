import 'server-only'
import type { Session } from 'next-auth'
import type { UiCapabilities } from '@/types/capabilities'
import type { UserRole } from '@/types/roles'

const MAX_ENTRIES = 2_000

type CacheEntry = {
  value: UiCapabilities
  globalGen: number
  orgGen: number
  identityGen: number
}

let globalGeneration = 0
const orgGenerations = new Map<string, number>()
const identityGenerations = new Map<string, number>()
const store = new Map<string, CacheEntry>()

function identityKey(orgId: string | null, role: UserRole, orgRoleId: string | null): string {
  return `${orgId ?? '_'}|${role}|${orgRoleId ?? '_'}`
}

function sessionCacheKey(session: Session): string {
  const u = session.user
  return [
    u.id ?? '',
    u.realRole ?? u.role ?? '',
    u.role ?? '',
    u.orgId ?? '',
    u.orgRoleId ?? '',
    u.actingOrgId ?? '',
    u.impersonation?.userId ?? '',
    u.impersonation?.role ?? '',
    u.impersonation?.orgRoleId ?? '',
  ].join(':')
}

function currentIdentityGen(orgId: string | null, role: UserRole, orgRoleId: string | null): number {
  return identityGenerations.get(identityKey(orgId, role, orgRoleId)) ?? 0
}

function currentOrgGen(orgId: string | null): number {
  return orgId ? (orgGenerations.get(orgId) ?? 0) : 0
}

function isEntryValid(
  entry: CacheEntry,
  orgId: string | null,
  role: UserRole,
  orgRoleId: string | null,
): boolean {
  return (
    entry.globalGen === globalGeneration
    && entry.orgGen === currentOrgGen(orgId)
    && entry.identityGen === currentIdentityGen(orgId, role, orgRoleId)
  )
}

function trimStoreIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

export function getCachedCapabilities(
  session: Session,
  orgId: string | null,
  role: UserRole,
  orgRoleId: string | null,
): UiCapabilities | null {
  const key = sessionCacheKey(session)
  const entry = store.get(key)
  if (!entry || !isEntryValid(entry, orgId, role, orgRoleId)) {
    return null
  }
  return entry.value
}

export function setCachedCapabilities(
  session: Session,
  orgId: string | null,
  role: UserRole,
  orgRoleId: string | null,
  value: UiCapabilities,
): void {
  const key = sessionCacheKey(session)
  store.set(key, {
    value,
    globalGen: globalGeneration,
    orgGen: currentOrgGen(orgId),
    identityGen: currentIdentityGen(orgId, role, orgRoleId),
  })
  trimStoreIfNeeded()
}

/** Invalidates capabilities for every identity in an org (custom roles, matrix, etc.). */
export function invalidateCapabilitiesForOrg(orgId: string): void {
  orgGenerations.set(orgId, (orgGenerations.get(orgId) ?? 0) + 1)
}

/** Invalidates capabilities for a specific permission identity (role + optional custom org role). */
export function invalidateCapabilitiesIdentity(
  orgId: string | null,
  role: UserRole,
  orgRoleId: string | null,
): void {
  const key = identityKey(orgId, role, orgRoleId)
  identityGenerations.set(key, (identityGenerations.get(key) ?? 0) + 1)
}

/** Invalidates all cached capabilities (global role_permissions changes). */
export function invalidateCapabilitiesGlobal(): void {
  globalGeneration += 1
}

/**
 * Read-only generation accessors. Capabilities are derived from the underlying permission
 * matrix (role_permissions / org_role_permissions / organization_settings), so these
 * generation counters double as the "permission-relevant data changed" signal for other
 * in-memory caches (see `permissions.ts`'s process-level permission cache) — invalidating
 * here via `invalidateCapabilitiesForOrg`/`invalidateCapabilitiesIdentity` at the existing
 * mutation call sites keeps both caches correct without a second set of invalidation hooks.
 */
export function currentGlobalGeneration(): number {
  return globalGeneration
}

export function currentOrgGeneration(orgId: string | null): number {
  return currentOrgGen(orgId)
}

export function currentIdentityGeneration(
  orgId: string | null,
  role: UserRole,
  orgRoleId: string | null,
): number {
  return currentIdentityGen(orgId, role, orgRoleId)
}

/** Test helper — clears in-memory cache and generation counters. */
export function clearCapabilitiesCache(): void {
  store.clear()
  orgGenerations.clear()
  identityGenerations.clear()
  globalGeneration = 0
}
