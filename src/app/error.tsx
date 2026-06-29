'use client'

import { useEffect } from 'react'
import { StatusPage } from '@/components/layout/StatusPage'

export default function RootError({
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
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <StatusPage
        code="500"
        title="Algo salió mal"
        description="Ocurrió un error inesperado. Podés reintentar o volver al inicio."
        showLogo
        primaryAction={{ label: 'Reintentar', onClick: reset }}
        secondaryAction={{ label: 'Ir al inicio', href: '/', variant: 'secondary' }}
      />
    </div>
  )
}
