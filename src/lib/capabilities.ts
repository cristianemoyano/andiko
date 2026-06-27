import 'server-only'
import { cache } from 'react'
import type { Session } from 'next-auth'
import {
  getPermissionsForUser,
  isModulePermission,
  isSettingsPermission,
  type Permission,
  type SettingsPermission,
} from '@/lib/permissions'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import {
  getCachedCapabilities,
  setCachedCapabilities,
} from '@/lib/capabilities-cache'
import { hasPanelAccess } from '@/lib/panel-access'
import type { UiCapabilities } from '@/types/capabilities'
import type { UserRole } from '@/types/roles'

type SessionUser = NonNullable<Session['user']> & {
  role: UserRole
  realRole: UserRole
  orgId: string | null
  branchId?: string | null
  orgRoleId?: string | null
  actingOrgId?: string | null
  impersonation?: { userId: string } | null
}

function hasSettings(perms: Permission[], level: SettingsPermission): boolean {
  return perms.includes(level)
}

function buildCapabilities(
  user: SessionUser,
  orgId: string | null,
  perms: Permission[],
): UiCapabilities {
  const realRole = user.realRole ?? user.role
  const isRealSysAdmin = realRole === 'sys-admin'
  const isImpersonating = !!user.impersonation
  const isPlatformSysAdmin = isRealSysAdmin && !isImpersonating

  const modulePerms = perms.filter(isModulePermission)
  const settingsPerms = perms.filter(isSettingsPermission)

  const canSettingsRead = isPlatformSysAdmin || hasSettings(perms, 'settings:read')
  const canSettingsWrite = isPlatformSysAdmin || hasSettings(perms, 'settings:write')

  const apiNamespace: 'sys-admin' | 'settings' = isPlatformSysAdmin ? 'sys-admin' : 'settings'

  const organizacionesHref = isPlatformSysAdmin
    ? '/organizaciones'
    : canSettingsRead && orgId
      ? `/organizaciones/${orgId}`
      : null

  const canPanel = hasPanelAccess(perms)

  return {
    permissions: modulePerms,
    settingsPermissions: settingsPerms,
    platform: {
      listOrganizations: isPlatformSysAdmin,
      sysAdminEmail: isPlatformSysAdmin,
      impersonation: isPlatformSysAdmin,
    },
    nav: {
      panel: canPanel,
      panelBranchId: canPanel && user.role === 'branch-admin' ? (user.branchId ?? null) : null,
      organizaciones: isPlatformSysAdmin || canSettingsRead,
      organizacionesHref,
      configuracion: true,
      facturacion: !isPlatformSysAdmin && canSettingsRead && !!orgId,
    },
    organizacion: {
      detail: isPlatformSysAdmin || (canSettingsRead && !!orgId),
      apiNamespace,
      sections: {
        fiscal: isPlatformSysAdmin || canSettingsRead,
        fiscalEdit: isPlatformSysAdmin || canSettingsWrite,
        orgMetaEdit: isPlatformSysAdmin,
        deleteOrg: isPlatformSysAdmin,
        enabledModules: isPlatformSysAdmin,
        users: isPlatformSysAdmin || canSettingsRead,
        branches: isPlatformSysAdmin || canSettingsRead,
        rolesMatrix: isPlatformSysAdmin || canSettingsWrite,
      },
      actions: {
        createUser: isPlatformSysAdmin || canSettingsWrite,
        editUser: isPlatformSysAdmin || canSettingsWrite,
        deleteUser: isPlatformSysAdmin || canSettingsWrite,
        createBranch: isPlatformSysAdmin || canSettingsWrite,
        editBranch: isPlatformSysAdmin || canSettingsWrite,
        deleteBranch: isPlatformSysAdmin || canSettingsWrite,
        saveRolesMatrix: isPlatformSysAdmin || canSettingsWrite,
      },
    },
    configuracion: {
      tabs: {
        impresion: canSettingsRead,
        plantillasEmail: canSettingsRead,
        emailsEnviados: canSettingsRead,
        apariencia: true,
        afip: canSettingsRead,
      },
    },
    onboarding: {
      manage: canSettingsWrite,
    },
  }
}

const loadCapabilities = cache(async (session: Session): Promise<UiCapabilities | null> => {
  const user = session.user as SessionUser
  const realRole = user.realRole ?? user.role
  const role = user.role
  const orgRoleId = user.orgRoleId ?? null

  const orgId = await resolveOrgIdForMutation({
    orgId: user.orgId,
    actingOrgId: user.actingOrgId,
    role,
    realRole,
  })

  const cached = getCachedCapabilities(session, orgId, role, orgRoleId)
  if (cached) return cached

  const perms = await getPermissionsForUser({ role, orgRoleId }, orgId ?? undefined)
  const capabilities = buildCapabilities(user, orgId, perms)
  setCachedCapabilities(session, orgId, role, orgRoleId, capabilities)
  return capabilities
})

export async function resolveCapabilities(session: Session | null): Promise<UiCapabilities | null> {
  if (!session?.user) return null
  return loadCapabilities(session)
}
