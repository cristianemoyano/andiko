import { Providers } from '@/components/layout/Providers'
import { LegalPageShell } from '@/components/layout/LegalPageShell'

export default function LegalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers forcedTheme="light">
      <LegalPageShell>{children}</LegalPageShell>
    </Providers>
  )
}
