'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { fetchLandingPath } from '@/lib/landing-path-client'

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'Email o contraseña incorrectos.',
  default: 'Ocurrió un error. Intentá de nuevo.',
}

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: form.get('email'),
      password: form.get('password'),
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError(ERRORS[result.error] ?? ERRORS.default)
      return
    }

    const path = await fetchLandingPath()
    router.push(path)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <FormField label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="usuario@empresa.com"
          disabled={loading}
        />
      </FormField>

      <FormField label="Contraseña" htmlFor="password" required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          disabled={loading}
        />
      </FormField>

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
        {loading ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
