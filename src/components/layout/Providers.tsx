'use client'

import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@teispace/next-themes'
import { SidebarProvider } from './SidebarContext'

export function Providers({
  children,
  forcedTheme,
}: {
  children: ReactNode
  /** Pin a theme regardless of user preference (e.g. "light" for print documents). */
  forcedTheme?: string
}) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        forcedTheme={forcedTheme}
      >
        <SidebarProvider>{children}</SidebarProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
