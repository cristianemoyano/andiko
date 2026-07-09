'use client'

import { useEffect } from 'react'
import { StatusPage } from '@/components/layout/StatusPage'
import { captureClientException } from '@/lib/posthog-errors-client'

export default function DocumentPrintError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    captureClientException(error, { boundary: 'document-print' })
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
      <StatusPage
        code="500"
        title="No se pudo generar el documento"
        description="Ocurrió un error al preparar la vista de impresión. Reintentá o volvé al ERP."
        primaryAction={{ label: 'Reintentar', onClick: reset }}
        secondaryAction={{ label: 'Volver al ERP', href: '/panel', variant: 'secondary' }}
      />
    </div>
  )
}
