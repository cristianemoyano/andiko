import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { TopBar } from '@/components/layout/TopBar'
import { Badge } from '@/components/primitives/Badge'
import type { AuthedSession } from '@/lib/api-handler'

export const metadata = { title: 'Mi perfil — Andiko ERP' }

const ROLE_LABEL: Record<string, string> = {
  'sys-admin': 'Super Admin',
  admin:       'Administrador',
  operator:    'Operador',
  readonly:    'Solo lectura',
}

const ROLE_STATUS: Record<string, 'info' | 'success' | 'pending' | 'neutral'> = {
  'sys-admin': 'info',
  admin:       'success',
  operator:    'pending',
  readonly:    'neutral',
}

export default async function PerfilPage() {
  const session = await auth() as AuthedSession | null
  if (!session) redirect('/login')

  const { name, email, role, orgId, branchId } = {
    name:     session.user.name,
    email:    session.user.email,
    role:     session.user.role,
    orgId:    session.user.orgId,
    branchId: session.user.branchId,
  }

  const initials = name
    ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Mi perfil' }]} />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-lg space-y-4">

          {/* Avatar + nombre */}
          <div className="bg-white border border-zinc-200 rounded-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-800 text-lg font-semibold flex items-center justify-center flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">{name ?? '—'}</div>
              <div className="text-xs text-zinc-500 truncate">{email}</div>
            </div>
            <div className="ml-auto">
              <Badge status={ROLE_STATUS[role] ?? 'neutral'}>
                {ROLE_LABEL[role] ?? role}
              </Badge>
            </div>
          </div>

          {/* Detalles */}
          <div className="bg-white border border-zinc-200 rounded-sm divide-y divide-zinc-100">
            <Row label="Nombre" value={name ?? '—'} />
            <Row label="Email" value={email ?? '—'} />
            <Row label="Rol" value={ROLE_LABEL[role] ?? role} />
            <Row label="Organización" value={orgId ?? 'Sin organización asignada'} muted={!orgId} />
            <Row label="Sucursal" value={branchId ?? 'Acceso a todas las sucursales'} muted={!branchId} />
          </div>

        </div>
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="text-xs text-zinc-500 w-32 flex-shrink-0">{label}</span>
      <span className={`text-sm ${muted ? 'text-zinc-400 italic' : 'text-zinc-900'}`}>{value}</span>
    </div>
  )
}
