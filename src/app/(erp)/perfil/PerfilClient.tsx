'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Badge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { ProfileView } from '@/modules/auth/profile.service'
import { resolveUserRoleBadgeStatus } from '@/modules/auth/role-labels'

type Props = {
  initial: ProfileView
  isImpersonating: boolean
}

export function PerfilClient({ initial, isImpersonating }: Props) {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [profile, setProfile] = useState(initial)
  const [formKey, setFormKey] = useState(0)
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchJson<{ profile: ProfileView }>('/api/v1/me/profile')
        if (!cancelled) {
          setProfile(data.profile)
          setFirstName(data.profile.firstName)
          setLastName(data.profile.lastName)
        }
      } catch {
        // Keep server-rendered profile on failure.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : profile.email?.[0]?.toUpperCase() ?? '?'

  const requiresCurrentPassword = !isImpersonating

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setServerError(null)

    const nextErrors: Record<string, string> = {}
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    if (!trimmedFirstName) nextErrors.firstName = 'El nombre es obligatorio'

    const trimmedPassword = password.trim()
    if (trimmedPassword && trimmedPassword.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres'
    }
    if (trimmedPassword && requiresCurrentPassword && !currentPassword.trim()) {
      nextErrors.currentPassword = 'Ingresá tu contraseña actual'
    }

    const nameChanged =
      trimmedFirstName !== profile.firstName || trimmedLastName !== profile.lastName
    const passwordChanged = trimmedPassword.length > 0
    if (!nameChanged && !passwordChanged) {
      nextErrors.firstName = 'No hay cambios para guardar'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const body: Record<string, string> = {}
    if (nameChanged) {
      body.firstName = trimmedFirstName
      body.lastName = trimmedLastName
    }
    if (passwordChanged) {
      body.password = trimmedPassword
      if (requiresCurrentPassword) body.currentPassword = currentPassword.trim()
    }

    setSaving(true)
    try {
      const data = await fetchJson<{ profile: ProfileView }>('/api/v1/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setProfile(data.profile)
      setFirstName(data.profile.firstName)
      setLastName(data.profile.lastName)
      setPassword('')
      setCurrentPassword('')
      setFormKey(k => k + 1)
      setRefresh(r => r + 1)

      if (isImpersonating && session?.user.impersonation?.userId) {
        await update({ impersonation: { userId: session.user.impersonation.userId } })
      } else {
        await update()
      }
      router.refresh()
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Mi perfil' }]} />

      <PageBody padding="p-6">
        <div className="max-w-lg space-y-4">
          {isImpersonating && (
            <div
              className="rounded-sm border border-warning bg-warning-bg px-4 py-3 text-[12px] text-warning leading-snug"
              role="status"
            >
              Estás impersonando a este usuario. Los cambios se guardan en su cuenta.
            </div>
          )}

          <div className="bg-surface border border-border rounded-sm p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-800 text-lg font-semibold flex items-center justify-center flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg">{profile.name}</div>
              <div className="text-xs text-fg-muted truncate">{profile.email}</div>
            </div>
            <div className="ml-auto">
              <Badge status={resolveUserRoleBadgeStatus(profile.role, profile.orgRoleId)}>
                {profile.roleLabel}
              </Badge>
            </div>
          </div>

          <form
            key={formKey}
            onSubmit={e => void handleSubmit(e)}
            className="bg-surface border border-border rounded-sm p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-fg">Datos personales</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nombre" htmlFor="profile_first_name" error={errors.firstName} required>
                <Input
                  id="profile_first_name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  error={!!errors.firstName}
                />
              </FormField>
              <FormField label="Apellido" htmlFor="profile_last_name" error={errors.lastName}>
                <Input
                  id="profile_last_name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  error={!!errors.lastName}
                />
              </FormField>
            </div>

            <FormField label="Email" htmlFor="profile_email">
              <Input
                id="profile_email"
                value={profile.email}
                readOnly
                disabled
                className="opacity-70"
              />
            </FormField>

            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-fg">Contraseña</h3>
              {!requiresCurrentPassword && (
                <p className="text-[12px] text-fg-muted">
                  Como sys-admin en modo impersonación podés establecer una nueva contraseña sin la actual.
                </p>
              )}

              {requiresCurrentPassword && (
                <FormField
                  label="Contraseña actual"
                  htmlFor="profile_current_password"
                  error={errors.currentPassword}
                >
                  <PasswordInput
                    id="profile_current_password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    error={!!errors.currentPassword}
                  />
                </FormField>
              )}

              <FormField
                label="Nueva contraseña"
                htmlFor="profile_password"
                error={errors.password}
              >
                <PasswordInput
                  id="profile_password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Dejar vacío para no cambiar"
                  error={!!errors.password}
                />
              </FormField>
            </div>

            <div className="bg-surface-muted border border-border rounded-sm divide-y divide-border">
              <Row label="Organización" value={profile.orgName ?? 'Sin organización asignada'} muted={!profile.orgName} />
              <Row label="Sucursal" value={profile.branchLabel} muted={profile.branchLabel.startsWith('Acceso')} />
            </div>

            {serverError && (
              <p role="alert" className="text-[12px] text-danger bg-danger-bg border border-danger rounded-sm px-3 py-2">
                {serverError}
              </p>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </div>
      </PageBody>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="text-xs text-fg-muted w-32 flex-shrink-0">{label}</span>
      <span className={`text-sm ${muted ? 'text-fg-subtle italic' : 'text-fg'}`}>{value}</span>
    </div>
  )
}
