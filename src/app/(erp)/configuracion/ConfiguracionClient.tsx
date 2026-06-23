'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/layout/Tabs'
import { PrintTemplateTab } from './PrintTemplateTab'
import { EmailTemplatesTab } from './EmailTemplatesTab'
import { EmailLogsTab } from './EmailLogsTab'
import { AppearanceTab } from './AppearanceTab'
import { AfipConfigTab } from './AfipConfigTab'
import { useCapabilities } from '@/components/layout/CapabilitiesContext'

type Section = 'impresion' | 'plantillas-email' | 'emails-enviados' | 'apariencia' | 'afip'

const SECTION_LABEL: Record<Section, string> = {
  impresion: 'Plantilla de impresión',
  'plantillas-email': 'Plantillas de email',
  'emails-enviados': 'Emails enviados',
  apariencia: 'Apariencia',
  afip: 'AFIP',
}

function parseSection(value: string | null): Section {
  if (value === 'plantillas-email' || value === 'emails-enviados' || value === 'apariencia' || value === 'afip') return value
  return 'impresion'
}

export function ConfiguracionClient({
  onboardingBanner = null,
}: {
  onboardingBanner?: 'resume' | 'revisit' | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { capabilities } = useCapabilities()
  const tabs = capabilities?.configuracion.tabs
  const requested = parseSection(searchParams.get('section'))

  if (!tabs) {
    return null
  }

  const defaultSection: Section = tabs.apariencia
    ? 'apariencia'
    : tabs.impresion
      ? 'impresion'
      : tabs.plantillasEmail
        ? 'plantillas-email'
        : tabs.emailsEnviados
          ? 'emails-enviados'
          : tabs.afip
            ? 'afip'
            : 'apariencia'

  const section = (
    (requested === 'impresion' && tabs.impresion) ||
    (requested === 'plantillas-email' && tabs.plantillasEmail) ||
    (requested === 'emails-enviados' && tabs.emailsEnviados) ||
    (requested === 'apariencia' && tabs.apariencia) ||
    (requested === 'afip' && tabs.afip)
  ) ? requested : defaultSection

  function handleSectionChange(next: string) {
    router.replace(`/configuracion?section=${next}`, { scroll: false })
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Configuración' }, { label: SECTION_LABEL[section] }]} />

      <PageBody padding="p-6">
        {onboardingBanner === 'resume' && (
          <div className="mb-4 rounded-sm border border-teal-200 bg-teal-50 px-4 py-3 text-[13px] text-teal-900">
            Tenés una configuración inicial sin terminar.{' '}
            <Link href="/onboarding" className="font-medium text-teal-800 hover:underline">
              Continuar configuración
            </Link>
          </div>
        )}
        {onboardingBanner === 'revisit' && session?.user?.orgId && (
          <div className="mb-4 rounded-sm border border-border bg-surface-muted px-4 py-3 text-[13px] text-fg-muted">
            ¿Querés revisar la configuración inicial de tu empresa?{' '}
            <Link href="/onboarding?revisit=1" className="font-medium text-teal-700 hover:underline">
              Abrir asistente de configuración
            </Link>
          </div>
        )}
        <Tabs value={section} onValueChange={handleSectionChange}>
          <TabsList>
            {tabs.impresion && <TabsTrigger value="impresion">Impresión</TabsTrigger>}
            {tabs.plantillasEmail && <TabsTrigger value="plantillas-email">Plantillas de email</TabsTrigger>}
            {tabs.emailsEnviados && <TabsTrigger value="emails-enviados">Emails enviados</TabsTrigger>}
            {tabs.apariencia && <TabsTrigger value="apariencia">Apariencia</TabsTrigger>}
            {tabs.afip && <TabsTrigger value="afip">AFIP</TabsTrigger>}
          </TabsList>

          {tabs.impresion && (
            <TabsContent value="impresion">
              <PrintTemplateTab />
            </TabsContent>
          )}
          {tabs.plantillasEmail && (
            <TabsContent value="plantillas-email">
              <EmailTemplatesTab />
            </TabsContent>
          )}
          {tabs.emailsEnviados && (
            <TabsContent value="emails-enviados">
              <EmailLogsTab />
            </TabsContent>
          )}
          {tabs.apariencia && (
            <TabsContent value="apariencia">
              <AppearanceTab />
            </TabsContent>
          )}
          {tabs.afip && (
            <TabsContent value="afip">
              <AfipConfigTab />
            </TabsContent>
          )}
        </Tabs>
      </PageBody>
    </div>
  )
}
