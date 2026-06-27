import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { resolveCapabilities } from '@/lib/capabilities'
import { resolveDefaultLandingPath } from '@/lib/panel-access'
import { getEffectiveOrganizationSettings } from '@/modules/auth/organization-settings.service'
import { resolveOrgIdForMutation } from '@/lib/session-org'
import Organization from '@/modules/auth/organization.model'
import { getPanelHiddenWidgets, getPanelWidgetOrder, getUserPreferences } from '@/modules/auth/user-preferences.service'
import { Suspense } from 'react'
import { PanelClient } from './PanelClient'

export const metadata = { title: 'Panel — Andiko ERP' }

export default async function HomePage() {
  const session = await auth() as AuthedSession | null
  const caps = await resolveCapabilities(session)
  if (!caps?.nav.panel) {
    const orgId = session?.user?.orgId ?? null
    const enabledModules = orgId
      ? (await getEffectiveOrganizationSettings(orgId)).enabled_modules
      : undefined
    redirect(resolveDefaultLandingPath(caps, enabledModules))
  }

  const userId = session?.user?.id ? resolveActorId(session) : null
  const preferences = userId ? await getUserPreferences(userId) : null
  const initialHiddenWidgets = preferences ? getPanelHiddenWidgets(preferences) : []
  const initialWidgetOrder = preferences ? getPanelWidgetOrder(preferences) : undefined

  const orgId = session?.user
    ? await resolveOrgIdForMutation({
        orgId: session.user.orgId,
        actingOrgId: session.user.actingOrgId,
        role: session.user.role,
        realRole: session.user.realRole,
      })
    : null
  const org = orgId
    ? await Organization.findByPk(orgId, { attributes: ['name', 'legal_name'] })
    : null
  const orgName = org ? (org.legal_name?.trim() || org.name) : null

  return (
    <Suspense>
      <PanelClient
        orgName={orgName}
        initialHiddenWidgets={initialHiddenWidgets}
        initialWidgetOrder={initialWidgetOrder}
        lockedBranchId={caps.nav.panelBranchId}
      />
    </Suspense>
  )
}
