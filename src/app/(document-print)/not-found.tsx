import { StatusPage } from '@/components/layout/StatusPage'

export default function DocumentPrintNotFound() {
  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
      <StatusPage
        code="404"
        title="Documento no encontrado"
        description="El comprobante o documento que buscás no existe o ya no está disponible."
        primaryAction={{ label: 'Volver al ERP', href: '/panel' }}
        secondaryAction={{ label: 'Volver atrás' }}
      />
    </div>
  )
}
