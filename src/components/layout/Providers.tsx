'use client'

import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { SidebarProvider } from './SidebarContext'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </SessionProvider>
  )
}
