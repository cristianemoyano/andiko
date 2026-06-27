import type { Metadata } from 'next'
import { SubscriptionDetail } from './SubscriptionDetail'

export const metadata: Metadata = { title: 'Suscripción — Andiko ERP' }

export default async function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SubscriptionDetail subscriptionId={id} />
}
