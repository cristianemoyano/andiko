import { StatusPage } from '@/components/layout/StatusPage'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <StatusPage
        code="404"
        title="Página no encontrada"
        description="La ruta que buscás no existe o fue movida. Revisá la URL o volvé al inicio."
        showLogo
        primaryAction={{ label: 'Ir al inicio', href: '/' }}
        secondaryAction={{ label: 'Iniciar sesión', href: '/login', variant: 'secondary' }}
      />
    </div>
  )
}
