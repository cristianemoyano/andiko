import { Suspense } from 'react'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export const metadata = { title: 'Recuperar contraseña — Andiko' }

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-brand-900/5 backdrop-blur-sm sm:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Recuperar contraseña</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Ingresá tu email y te enviamos un enlace para elegir una nueva contraseña.
        </p>
      </div>

      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}
