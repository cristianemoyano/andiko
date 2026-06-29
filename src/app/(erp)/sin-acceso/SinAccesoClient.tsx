'use client'

import { useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusPage } from '@/components/layout/StatusPage'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'
import { resolveDefaultLandingPath, type ModuleAccessDenialReason } from '@/lib/panel-access'

const REASON_COPY: Record<ModuleAccessDenialReason, { title: string; description: string }> = {
  forbidden: {
    title: 'Sin permiso para este módulo',
    description: 'Tu rol no tiene acceso a la sección que intentaste abrir. Pedile a un administrador de la organización que revise tus permisos.',
  },
  disabled: {
    title: 'Módulo no disponible',
    description: 'Esta funcionalidad no está habilitada en tu organización. Contactá a soporte si creés que debería estarlo.',
  },
}

function resolveReason(value: string | null): ModuleAccessDenialReason {
  return value === 'disabled' ? 'disabled' : 'forbidden'
}

export function SinAccesoClient() {
  const searchParams = useSearchParams()
  const { capabilities } = useCapabilities()
  const reason = resolveReason(searchParams.get('reason'))
  const copy = REASON_COPY[reason]
  const homeHref = resolveDefaultLandingPath(capabilities, undefined)

  return (
    <>
      <TopBar breadcrumbs={[{ label: 'Sin acceso' }]} />
      <PageBody>
        <StatusPage
          code="403"
          title={copy.title}
          description={copy.description}
          primaryAction={{ label: 'Ir al inicio', href: homeHref }}
          secondaryAction={{ label: 'Volver atrás' }}
        />
      </PageBody>
    </>
  )
}
