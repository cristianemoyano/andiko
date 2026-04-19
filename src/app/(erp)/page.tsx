import { auth } from '@/lib/auth'
import { TopBar } from '@/components/layout/TopBar'

export const metadata = { title: 'Panel — Andiko ERP' }

export default async function HomePage() {
  const session = await auth()

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Panel' }]} />
      <div className="p-6">
        <p className="text-sm text-zinc-500">
          Bienvenido, {session?.user?.name}. Dashboard en construcción.
        </p>
      </div>
    </div>
  )
}
