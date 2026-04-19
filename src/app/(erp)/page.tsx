import { auth } from '@/lib/auth'

export const metadata = { title: 'Panel — Andiko ERP' }

export default async function HomePage() {
  const session = await auth()

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">
        Bienvenido, {session?.user?.name}
      </h1>
      <p className="text-sm text-zinc-500 mt-1">Dashboard en construcción.</p>
    </div>
  )
}
