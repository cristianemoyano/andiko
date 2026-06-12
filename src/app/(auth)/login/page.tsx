import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Ingresar — Andiko' }

export default async function LoginPage() {
  const session = await auth()
  if (session) redirect('/panel')

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Andiko ERP</h1>
          <p className="text-sm text-gray-500 mt-1">Ingresá con tu cuenta</p>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
