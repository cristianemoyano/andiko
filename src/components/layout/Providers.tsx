'use client'

import type { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { SidebarProvider } from './SidebarContext'
import { CapabilitiesProvider } from './CapabilitiesContext'
import { PostHogSession } from './PostHogSession'
import type { UiCapabilities } from '@/types/capabilities'

export function Providers({
  children,
  forcedTheme,
  initialCapabilities = null,
  capabilitiesKey = 'none',
}: {
  children: ReactNode
  /** Pin a theme regardless of user preference (e.g. "light" for print documents). */
  forcedTheme?: string
  /** Server-resolved capabilities; hydrated into CapabilitiesProvider without an initial fetch. */
  initialCapabilities?: UiCapabilities | null
  /** Remount provider when server caps change (navigation). */
  capabilitiesKey?: string
}) {
  return (
    <SessionProvider>
      <PostHogSession />
      <CapabilitiesProvider key={capabilitiesKey} initial={initialCapabilities}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          forcedTheme={forcedTheme}
        >
          <SidebarProvider>{children}</SidebarProvider>
        </ThemeProvider>
      </CapabilitiesProvider>
    </SessionProvider>
  )
}
