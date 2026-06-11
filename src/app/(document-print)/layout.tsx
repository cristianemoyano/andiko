import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Providers } from '@/components/layout/Providers'

export default async function DocumentPrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <Providers>
      <div className="min-h-screen bg-zinc-100 print:bg-white">{children}</div>
    </Providers>
  )
}
