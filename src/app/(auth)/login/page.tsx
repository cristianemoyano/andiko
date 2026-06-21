import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { resolvePostAuthRedirect } from '@/lib/post-auth-redirect'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Ingresar — Andiko' }

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect(await resolvePostAuthRedirect(session))

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-brand-900/5 backdrop-blur-sm sm:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Ingresá a tu cuenta</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Accedé al panel de gestión de tu empresa con tu email y contraseña.
        </p>
      </div>

      <LoginForm />
    </div>
  )
}
