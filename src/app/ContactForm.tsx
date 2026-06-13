'use client'

import { useState } from 'react'

const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = { name?: string; email?: string }

const inputBase =
  'h-10 w-full rounded-[4px] border bg-white px-3 text-sm text-zinc-900 outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-zinc-400 focus:border-brand-600 focus:shadow-[0_0_0_3px_rgba(208,238,243,0.6)] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

export function ContactForm() {
  const [formKey, setFormKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)

    const form = new FormData(e.currentTarget)
    if (form.get('botcheck')) return

    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const message = String(form.get('message') ?? '').trim()

    const nextErrors: FieldErrors = {}
    if (!name) nextErrors.name = 'Ingresá tu nombre.'
    if (!email) nextErrors.email = 'Ingresá tu email.'
    else if (!EMAIL_RE.test(email)) nextErrors.email = 'El email no es válido.'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    setErrors({})

    if (!ACCESS_KEY) {
      setServerError('El formulario no está configurado.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: 'Acceso anticipado — Andiko (Beta privada)',
          from_name: 'Andiko Landing',
          name,
          email,
          message,
          botcheck: '',
        }),
      })

      const data = (await response.json()) as { success?: boolean; message?: string }

      if (!response.ok || !data.success) {
        setServerError(data.message ?? 'No pudimos enviarlo. Intentá de nuevo.')
        return
      }

      setSentEmail(email)
      setFormKey((k) => k + 1)
    } catch {
      setServerError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white/80 p-[clamp(22px,3vw,30px)] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_18px_44px_-22px_rgba(12,100,122,0.3)] backdrop-blur-sm">
      {sentEmail ? (
        <div className="px-2 py-5 text-center">
          <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-green-300 bg-green-100">
            <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div className="mt-4 text-lg font-semibold text-zinc-900">Listo, te anotamos</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Te vamos a escribir a{' '}
            <span className="font-mono text-[13px] text-brand-700">{sentEmail}</span> cuando abramos
            el acceso anticipado.
          </p>
        </div>
      ) : (
        <form key={formKey} onSubmit={handleSubmit} noValidate>
          <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          <div className="mb-4">
            <label htmlFor="contact-name" className="mb-1.5 block text-[13px] font-medium text-zinc-600">
              Nombre
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Ej: María González"
              disabled={loading}
              aria-invalid={errors.name ? 'true' : undefined}
              className={`${inputBase} ${errors.name ? 'border-red-600' : 'border-zinc-300'}`}
            />
            {errors.name && (
              <div role="alert" className="mt-[7px] rounded-[4px] border border-red-200 bg-red-50 px-[9px] py-1.5 text-xs text-red-700">
                {errors.name}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="contact-email" className="mb-1.5 block text-[13px] font-medium text-zinc-600">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@empresa.com.ar"
              disabled={loading}
              aria-invalid={errors.email ? 'true' : undefined}
              className={`${inputBase} ${errors.email ? 'border-red-600' : 'border-zinc-300'}`}
            />
            {errors.email && (
              <div role="alert" className="mt-[7px] rounded-[4px] border border-red-200 bg-red-50 px-[9px] py-1.5 text-xs text-red-700">
                {errors.email}
              </div>
            )}
          </div>

          <div className="mb-5">
            <label htmlFor="contact-message" className="mb-1.5 block text-[13px] font-medium text-zinc-600">
              Mensaje <span className="font-normal text-zinc-400">(opcional)</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={3}
              placeholder="Contanos de tu pyme: rubro, cantidad de personas, qué usás hoy…"
              disabled={loading}
              className="h-[84px] w-full resize-none rounded-[4px] border border-zinc-300 bg-white px-3 py-[9px] text-sm leading-relaxed text-zinc-900 outline-none transition-[border-color,box-shadow] duration-[120ms] placeholder:text-zinc-400 focus:border-brand-600 focus:shadow-[0_0_0_3px_rgba(208,238,243,0.6)] disabled:cursor-not-allowed disabled:bg-zinc-100"
            />
          </div>

          {serverError && (
            <div role="alert" className="mb-4 rounded-[4px] border border-red-200 bg-red-50 px-[9px] py-1.5 text-xs text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-[4px] bg-brand-600 text-[15px] font-semibold text-white transition-colors duration-[120ms] hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {loading ? 'Enviando…' : 'Mantenerme al tanto'}
          </button>
          <p className="mt-3.5 text-center text-xs text-zinc-400">
            Al enviar aceptás que te contactemos sobre el lanzamiento de Andiko.
          </p>
        </form>
      )}
    </div>
  )
}
