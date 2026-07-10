'use client'

import { useMemo, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { fetchLandingPath } from '@/lib/landing-path-client'
import { solveCapChallenge } from '@/lib/cap-solve'
import { isCapEnabled } from '@/lib/cap-config'
import {
  fetchLoginThrottleSeconds,
  formatLoginThrottleMessage,
  parseLoginThrottledCode,
} from '@/lib/login-throttle-message'

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'Email o contraseña incorrectos.',
  default: 'Ocurrió un error. Intentá de nuevo.',
}

function resolveLoginError(error: string, retryAfterSeconds: number | null): string {
  if (retryAfterSeconds !== null) {
    return formatLoginThrottleMessage(retryAfterSeconds)
  }
  return ERRORS[error] ?? ERRORS.default
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlThrottleSeconds = useMemo(
    () => parseLoginThrottledCode(searchParams.get('code') ?? undefined),
    [searchParams],
  )
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitThrottled, setSubmitThrottled] = useState(false)

  const throttled = submitThrottled || urlThrottleSeconds !== null
  const error = submitError ?? (
    urlThrottleSeconds !== null ? formatLoginThrottleMessage(urlThrottleSeconds) : null
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitThrottled(false)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '')

    let capToken: string | null = null
    if (isCapEnabled()) {
      setVerifying(true)
      try {
        capToken = await solveCapChallenge()
        if (!capToken) {
          setSubmitError(ERRORS.default)
          setLoading(false)
          setVerifying(false)
          return
        }
      } catch {
        setSubmitError(ERRORS.default)
        setLoading(false)
        setVerifying(false)
        return
      }
      setVerifying(false)
    }

    const result = await signIn('credentials', {
      email,
      password: form.get('password'),
      capToken,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      let retrySeconds = parseLoginThrottledCode(result.code)
      if (retrySeconds === null) {
        retrySeconds = await fetchLoginThrottleSeconds(email)
      }
      setSubmitThrottled(retrySeconds !== null)
      setSubmitError(resolveLoginError(result.error, retrySeconds))
      return
    }

    const path = await fetchLandingPath()
    router.push(path)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate data-testid="login-form">
      <FormField label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          data-testid="login-email-input"
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
          data-testid="login-password-input"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          disabled={loading}
        />
      </FormField>

      {error && (
        <p
          role="alert"
          data-testid="login-error"
          className={
            throttled
              ? 'text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2'
              : 'text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2'
          }
        >
          {error}
        </p>
      )}

      <Button type="submit" data-testid="login-submit-btn" disabled={loading} size="lg" className="w-full mt-1">
        {verifying ? 'Verificando…' : loading ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
