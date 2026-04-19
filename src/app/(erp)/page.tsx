import { auth } from '@/lib/auth'

export const metadata = { title: 'Inicio — Andiko ERP' }

export default async function HomePage() {
  const session = await auth()

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">
        Bienvenido, {session?.user?.name}
      </h1>
      <p className="text-sm text-gray-500 mt-1">Dashboard en construcción.</p>
    </div>
  )
}
