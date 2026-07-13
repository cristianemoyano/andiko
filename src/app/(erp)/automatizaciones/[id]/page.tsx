import type { Metadata } from 'next'
import { AutomationDetailClient } from './AutomationDetailClient'

export const metadata: Metadata = { title: 'Automatización' }

export default async function AutomatizacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AutomationDetailClient taskId={id} />
}
