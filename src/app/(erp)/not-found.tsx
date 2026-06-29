import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusPage } from '@/components/layout/StatusPage'

export default function ErpNotFound() {
  return (
    <>
      <TopBar breadcrumbs={[{ label: 'No encontrado' }]} />
      <PageBody>
        <StatusPage
          code="404"
          title="Página no encontrada"
          description="El recurso no existe, fue eliminado o no tenés acceso a esta sección."
          primaryAction={{ label: 'Ir al panel', href: '/panel' }}
          secondaryAction={{ label: 'Volver atrás' }}
        />
      </PageBody>
    </>
  )
}
