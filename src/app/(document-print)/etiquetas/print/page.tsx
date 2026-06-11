import type { Metadata } from 'next'
import { EtiquetasPrintClient } from './EtiquetasPrintClient'

export const metadata: Metadata = { title: 'Etiquetas de góndola' }

interface Props {
  searchParams: Promise<{ key?: string; size?: string }>
}

export default async function EtiquetasPrintPage({ searchParams }: Props) {
  const { key, size } = await searchParams
  return (
    <EtiquetasPrintClient
      storageKey={key ?? ''}
      size={size === 'large' ? 'large' : 'small'}
    />
  )
}
