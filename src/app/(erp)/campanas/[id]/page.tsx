import type { Metadata } from 'next'
import { CampanaFormClient } from '../CampanaFormClient'

export const metadata: Metadata = { title: 'Editar campaña — Andiko ERP' }

export default async function EditarCampanaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CampanaFormClient campaignId={id} />
}
