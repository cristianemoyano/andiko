'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
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

export function ConfiguracionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

      <div className="flex-1 overflow-y-auto p-6">
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
      </div>
    </div>
  )
}
