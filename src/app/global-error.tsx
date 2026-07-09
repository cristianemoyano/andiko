'use client'

import { useEffect } from 'react'
import { StatusPage } from '@/components/layout/StatusPage'
import { captureClientException } from '@/lib/posthog-errors-client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    captureClientException(error, { boundary: 'global' })
  }, [error])

  return (
    <html lang="es">
      <body className="min-h-screen bg-[#FAFAFA] antialiased">
        <StatusPage
          code="500"
          title="Error crítico"
          description="La aplicación encontró un problema grave. Reintentá o recargá la página."
          primaryAction={{ label: 'Reintentar', onClick: reset }}
          secondaryAction={{ label: 'Recargar página', onClick: () => window.location.reload(), variant: 'secondary' }}
        />
      </body>
    </html>
  )
}
