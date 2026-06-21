import { auth } from '@/lib/auth'
import { resolveActorId, type AuthedSession } from '@/lib/api-handler'
import { getPanelHiddenWidgets, getPanelWidgetOrder, getUserPreferences } from '@/modules/auth/user-preferences.service'
import { Suspense } from 'react'
import { PanelClient } from './PanelClient'

export const metadata = { title: 'Panel — Andiko ERP' }

export default async function HomePage() {
  const session = await auth() as AuthedSession | null
  const userId = session?.user?.id ? resolveActorId(session) : null
  const preferences = userId ? await getUserPreferences(userId) : null
  const initialHiddenWidgets = preferences ? getPanelHiddenWidgets(preferences) : []
  const initialWidgetOrder = preferences ? getPanelWidgetOrder(preferences) : undefined

  return (
    <Suspense>
      <PanelClient
        initialHiddenWidgets={initialHiddenWidgets}
        initialWidgetOrder={initialWidgetOrder}
      />
    </Suspense>
  )
}
