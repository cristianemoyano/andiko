'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/layout/Tabs'
import { PrintTemplateTab } from './PrintTemplateTab'
import { EmailTemplatesTab } from './EmailTemplatesTab'

type Section = 'impresion' | 'plantillas-email'

export function ConfiguracionClient() {
  const [section, setSection] = useState<Section>('impresion')

  const breadcrumbLabel = section === 'impresion' ? 'Plantilla de impresión' : 'Plantillas de email'

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Configuración' }, { label: breadcrumbLabel }]} />

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={section} onValueChange={v => setSection(v as Section)}>
          <TabsList>
            <TabsTrigger value="impresion">Impresión</TabsTrigger>
            <TabsTrigger value="plantillas-email">Plantillas de email</TabsTrigger>
          </TabsList>

          <TabsContent value="impresion">
            <PrintTemplateTab />
          </TabsContent>
          <TabsContent value="plantillas-email">
            <EmailTemplatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
