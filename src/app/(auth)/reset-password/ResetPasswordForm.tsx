'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          Enlace inválido o incompleto.
        </p>
        <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
          Solicitar un enlace nuevo
        </Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)

    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirmPassword = String(form.get('confirmPassword') ?? '')

    const nextErrors: Record<string, string> = {}
    if (password.length < 8) nextErrors.password = 'Debe tener al menos 8 caracteres'
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Las contraseñas no coinciden'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      await fetchJson('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      router.push('/login?reset=1')
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FormField label="Nueva contraseña" htmlFor="password" required error={errors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          disabled={loading}
          error={!!errors.password}
        />
      </FormField>

      <FormField label="Confirmar contraseña" htmlFor="confirmPassword" required error={errors.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          disabled={loading}
          error={!!errors.confirmPassword}
        />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
        {loading ? 'Guardando…' : 'Restablecer contraseña'}
      </Button>
    </form>
  )
}
