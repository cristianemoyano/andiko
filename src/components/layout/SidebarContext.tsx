'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarContextValue {
  /** Whether the mobile off-canvas drawer is open. Always ignored at md+ (sidebar is static). */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

/**
 * Safe no-op default so components rendered outside a provider (e.g. isolated
 * Storybook stories) don't throw. In-app, SidebarProvider always wraps the shell.
 */
const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const value: SidebarContextValue = {
    open,
    setOpen,
    toggle: () => setOpen(o => !o),
  }

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext)
}
