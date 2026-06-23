'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarContextValue {
  /** Whether the mobile off-canvas drawer is open. Always ignored at md+ (sidebar is static). */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /** Whether the mobile full-screen menu panel is open. */
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  toggleMenu: () => void
}

/**
 * Safe no-op default so components rendered outside a provider (e.g. isolated
 * Storybook stories) don't throw. In-app, SidebarProvider always wraps the shell.
 */
const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
  menuOpen: false,
  setMenuOpen: () => {},
  toggleMenu: () => {},
})

export function SidebarProvider({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [menuOpen, setMenuOpen] = useState(false)

  const value: SidebarContextValue = {
    open,
    setOpen,
    toggle: () => setOpen(o => !o),
    menuOpen,
    setMenuOpen,
    toggleMenu: () => setMenuOpen(o => !o),
  }

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext)
}
