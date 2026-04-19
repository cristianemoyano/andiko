import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar y header se agregan en Fase DS */}
      <main className="p-6">{children}</main>
    </div>
  )
}
