import { Suspense } from 'react'
import { ResetPasswordForm } from './ResetPasswordForm'

export const metadata = { title: 'Restablecer contraseña — Andiko' }

export default function ResetPasswordPage() {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-brand-900/5 backdrop-blur-sm sm:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Elegí una nueva contraseña</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Ingresá tu nueva contraseña para continuar.
        </p>
      </div>

      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
