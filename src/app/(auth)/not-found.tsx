import { StatusPage } from '@/components/layout/StatusPage'

export default function AuthNotFound() {
  return (
    <StatusPage
      code="404"
      title="Página no encontrada"
      description="Esta ruta no existe. Volvé al inicio de sesión."
      primaryAction={{ label: 'Ir a login', href: '/login' }}
      secondaryAction={{ label: 'Ir al inicio', href: '/', variant: 'secondary' }}
    />
  )
}
