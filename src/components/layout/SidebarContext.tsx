'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react'

const SIDEBAR_COLLAPSED_KEY = 'andiko:sidebar-collapsed'
const SIDEBAR_COLLAPSED_EVENT = 'andiko:sidebar-collapsed-change'

interface SidebarContextValue {
  /** Whether the mobile off-canvas drawer is open. Always ignored at md+ (sidebar is static). */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /** Whether the mobile full-screen menu panel is open. */
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  toggleMenu: () => void
  /** Whether the desktop sidebar is collapsed to an icon rail. Ignored on mobile. */
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
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
  collapsed: false,
  setCollapsed: () => {},
  toggleCollapsed: () => {},
})

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsedPreference(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function subscribeCollapsed(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_COLLAPSED_KEY || e.key === null) onStoreChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  }
}

function getCollapsedSnapshot(): boolean {
  return readCollapsedPreference()
}

function getCollapsedServerSnapshot(): boolean {
  return false
}

export function SidebarProvider({
  children,
  defaultOpen = false,
  defaultCollapsed = false,
  persistCollapsed = true,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  /** Initial collapsed state when persistCollapsed is false (Storybook / tests). */
  defaultCollapsed?: boolean
  /** When false, skip localStorage (Storybook). Default true. */
  persistCollapsed?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [menuOpen, setMenuOpen] = useState(false)
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed)

  const persistedCollapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  )

  const collapsed = persistCollapsed ? persistedCollapsed : localCollapsed

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (persistCollapsed) {
        writeCollapsedPreference(next)
      } else {
        setLocalCollapsed(next)
      }
    },
    [persistCollapsed],
  )

  const toggleCollapsed = useCallback(() => {
    if (persistCollapsed) {
      writeCollapsedPreference(!readCollapsedPreference())
    } else {
      setLocalCollapsed(prev => !prev)
    }
  }, [persistCollapsed])

  const value: SidebarContextValue = {
    open,
    setOpen,
    toggle: () => setOpen(o => !o),
    menuOpen,
    setMenuOpen,
    toggleMenu: () => setMenuOpen(o => !o),
    collapsed,
    setCollapsed,
    toggleCollapsed,
  }

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarContextValue {
  return useContext(SidebarContext)
}
