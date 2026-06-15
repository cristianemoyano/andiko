import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Providers } from '@/components/layout/Providers'

export default async function DocumentPrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // Fiscal documents must always render light, regardless of the user's theme,
  // so on-screen previews and printed/PDF output stay white.
  return (
    <Providers forcedTheme="light">
      <div className="min-h-screen bg-zinc-100 print:bg-white">{children}</div>
    </Providers>
  )
}
