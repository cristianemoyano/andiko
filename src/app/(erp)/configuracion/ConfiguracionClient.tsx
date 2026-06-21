'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/layout/Tabs'
import { PrintTemplateTab } from './PrintTemplateTab'
import { EmailTemplatesTab } from './EmailTemplatesTab'
import { EmailLogsTab } from './EmailLogsTab'
import { AppearanceTab } from './AppearanceTab'
import { AfipConfigTab } from './AfipConfigTab'

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
  const section = parseSection(searchParams.get('section'))

  function handleSectionChange(next: string) {
    router.replace(`/configuracion?section=${next}`, { scroll: false })
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Configuración' }, { label: SECTION_LABEL[section] }]} />

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={section} onValueChange={handleSectionChange}>
          <TabsList>
            <TabsTrigger value="impresion">Impresión</TabsTrigger>
            <TabsTrigger value="plantillas-email">Plantillas de email</TabsTrigger>
            <TabsTrigger value="emails-enviados">Emails enviados</TabsTrigger>
            <TabsTrigger value="apariencia">Apariencia</TabsTrigger>
            <TabsTrigger value="afip">AFIP</TabsTrigger>
          </TabsList>

          <TabsContent value="impresion">
            <PrintTemplateTab />
          </TabsContent>
          <TabsContent value="plantillas-email">
            <EmailTemplatesTab />
          </TabsContent>
          <TabsContent value="emails-enviados">
            <EmailLogsTab />
          </TabsContent>
          <TabsContent value="apariencia">
            <AppearanceTab />
          </TabsContent>
          <TabsContent value="afip">
            <AfipConfigTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
