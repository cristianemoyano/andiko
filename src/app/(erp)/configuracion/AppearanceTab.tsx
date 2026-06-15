'use client'

import { ThemeToggle } from '@/components/erp'

export function AppearanceTab() {
  return (
    <div className="max-w-2xl">
      <div className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold text-fg">Tema</h2>
        <p className="mt-1 text-[13px] text-fg-muted">
          Elegí cómo se ve la aplicación. «Sistema» sigue la preferencia de tu sistema operativo.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
