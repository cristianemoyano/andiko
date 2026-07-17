'use client'

import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusPage } from '@/components/layout/StatusPage'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'

export function SuspendidoClient() {
  const { capabilities } = useCapabilities()
  const canManageBilling = capabilities?.nav.facturacion ?? false

  const description = canManageBilling
    ? 'Tu suscripción está suspendida por falta de pago.'
    : 'Tu suscripción está suspendida por falta de pago. Contactá al administrador de tu organización para regularizar el pago.'

  return (
    <>
      <TopBar breadcrumbs={[{ label: 'Suscripción suspendida' }]} />
      <PageBody>
        <StatusPage
          code="403"
          title="Suscripción suspendida"
          description={description}
          primaryAction={
            canManageBilling
              ? { label: 'Ir a Suscripción', href: '/facturacion' }
              : { label: 'Volver atrás' }
          }
        />
      </PageBody>
    </>
  )
}
