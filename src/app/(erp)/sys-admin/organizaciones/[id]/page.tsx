import type { Metadata } from 'next'
import { OrgDetailClient } from './OrgDetailClient'

export const metadata: Metadata = { title: 'Organización — Sys-admin' }

type Props = { params: Promise<{ id: string }> }

export default async function OrgDetailPage({ params }: Props) {
  const { id } = await params
  return <OrgDetailClient id={id} />
}
