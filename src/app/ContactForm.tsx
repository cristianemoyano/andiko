'use client'

import { useState } from 'react'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Textarea } from '@/components/primitives/Textarea'
import { FormField } from '@/components/primitives/FormField'

const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY

export function ContactForm() {
  const [formKey, setFormKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)
    setSuccess(false)

    if (!ACCESS_KEY) {
      setServerError('El formulario no está configurado.')
      return
    }

    const form = new FormData(e.currentTarget)
    if (form.get('botcheck')) return

    setLoading(true)

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: 'Contacto — Andiko (Próximamente)',
          from_name: 'Andiko Landing',
          name: form.get('name'),
          email: form.get('email'),
          message: form.get('message'),
          botcheck: '',
        }),
      })

      const data = (await response.json()) as { success?: boolean; message?: string }

      if (!response.ok || !data.success) {
        setServerError(data.message ?? 'No pudimos enviar el mensaje. Intentá de nuevo.')
        return
      }

      setSuccess(true)
      setFormKey((k) => k + 1)
    } catch {
      setServerError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      aria-labelledby="contacto-heading"
      className="landing-enter landing-enter-delay-4 mt-14 w-full max-w-lg text-left"
    >
      <div className="mb-6 text-center">
        <h2 id="contacto-heading" className="text-xl font-semibold tracking-tight text-zinc-900">
          Escribinos
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Dejanos tu consulta y te avisamos cuando estemos listos.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        {success ? (
          <p
            role="status"
            className="rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800"
          >
            ¡Mensaje enviado! Te respondemos a la brevedad.
          </p>
        ) : (
          <form key={formKey} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <input
              type="checkbox"
              name="botcheck"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden
            />

            <FormField label="Nombre" htmlFor="contact-name">
              <Input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Tu nombre"
                disabled={loading}
              />
            </FormField>

            <FormField label="Email" htmlFor="contact-email" required>
              <Input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@empresa.com"
                disabled={loading}
              />
            </FormField>

            <FormField label="Mensaje" htmlFor="contact-message" required>
              <Textarea
                id="contact-message"
                name="message"
                required
                rows={4}
                placeholder="Contanos sobre tu pyme o qué te interesa de Andiko…"
                disabled={loading}
                className="min-h-[100px]"
              />
            </FormField>

            {serverError && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {serverError}
              </p>
            )}

            <Button type="submit" disabled={loading} size="md" className="mt-1 w-full">
              {loading ? 'Enviando…' : 'Enviar mensaje'}
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
