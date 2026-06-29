'use client'

import { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusPage } from '@/components/layout/StatusPage'

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <TopBar breadcrumbs={[{ label: 'Error' }]} />
      <PageBody>
        <StatusPage
          code="500"
          title="Algo salió mal"
          description="Ocurrió un error al cargar esta pantalla. Reintentá o volvé al panel."
          primaryAction={{ label: 'Reintentar', onClick: reset }}
          secondaryAction={{ label: 'Ir al panel', href: '/panel', variant: 'secondary' }}
        />
      </PageBody>
    </>
  )
}
