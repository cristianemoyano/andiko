import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { listAutomationActions } from '@/modules/automations/action-registry'
import '@/modules/automations/actions'

export const GET = withPermission('automations:read', async () => {
  const actions = listAutomationActions().map(a => ({ type: a.type, label: a.label }))
  return NextResponse.json({ data: actions })
})
