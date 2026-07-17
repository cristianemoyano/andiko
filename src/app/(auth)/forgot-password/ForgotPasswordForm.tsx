'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { FormField } from '@/components/primitives/FormField'
import { fetchJson } from '@/lib/fetch-json'

const GENERIC_MESSAGE = 'Si el email existe, te enviamos un enlace para restablecer tu contraseña.'

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '')

    try {
      await fetchJson('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    } catch {
      // Intentionally ignored: the response must not leak whether the
      // request "succeeded" differently for a valid vs. unknown email.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="text-sm text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
          {GENERIC_MESSAGE}
        </p>
        <Link href="/login" className="text-sm text-brand-600 hover:underline">
          Volver a ingresar
        </Link>
      </div>
    )
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

      <Button type="submit" disabled={loading} size="lg" className="w-full mt-1">
        {loading ? 'Enviando…' : 'Enviar enlace'}
      </Button>

      <Link href="/login" className="text-sm text-brand-600 hover:underline">
        Volver a ingresar
      </Link>
    </form>
  )
}
