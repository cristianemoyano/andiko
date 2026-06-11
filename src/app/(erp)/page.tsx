import { Suspense } from 'react'
import { PanelClient } from './PanelClient'

export const metadata = { title: 'Panel — Andiko ERP' }

export default function HomePage() {
  return (
    <Suspense>
      <PanelClient />
    </Suspense>
  )
}
