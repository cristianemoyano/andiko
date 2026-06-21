'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson } from '@/lib/fetch-json'
import {
  DEFAULT_PANEL_WIDGET_ORDER,
  PANEL_WIDGET_ORDER_STORAGE_KEY,
  PANEL_WIDGETS_STORAGE_KEY,
  normalizePanelWidgetOrder,
  parseHiddenPanelWidgets,
  type PanelWidgetId,
} from '@/modules/panel/panel-widget.types'

export interface PanelLayout {
  hidden: PanelWidgetId[]
  order: PanelWidgetId[]
}

interface PanelWidgetContextValue {
  ready: boolean
  hiddenIds: PanelWidgetId[]
  widgetOrder: PanelWidgetId[]
  isHidden: (id: PanelWidgetId) => boolean
  hide: (id: PanelWidgetId) => void
  show: (id: PanelWidgetId) => void
  resetAll: () => void
  applyLayout: (layout: PanelLayout) => void
  hasHidden: boolean
  hiddenCount: number
}

const PanelWidgetContext = createContext<PanelWidgetContextValue | null>(null)

interface PreferencesResponse {
  preferences?: {
    panel?: {
      hidden_widgets?: PanelWidgetId[]
      widget_order?: PanelWidgetId[]
    }
  }
}

function persistLocalFallback(hidden: PanelWidgetId[], order: PanelWidgetId[]) {
  try {
    if (hidden.length === 0) {
      localStorage.removeItem(PANEL_WIDGETS_STORAGE_KEY)
    } else {
      localStorage.setItem(PANEL_WIDGETS_STORAGE_KEY, JSON.stringify(hidden))
    }
    localStorage.setItem(PANEL_WIDGET_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Ignore storage failures.
  }
}

function parseLocalWidgetOrder(): PanelWidgetId[] {
  try {
    const raw = localStorage.getItem(PANEL_WIDGET_ORDER_STORAGE_KEY)
    if (!raw) return [...DEFAULT_PANEL_WIDGET_ORDER]
    return normalizePanelWidgetOrder(JSON.parse(raw))
  } catch {
    return [...DEFAULT_PANEL_WIDGET_ORDER]
  }
}

async function persistRemote(layout: PanelLayout) {
  await fetchJson<PreferencesResponse>('/api/v1/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify({
      panel: {
        hidden_widgets: layout.hidden,
        widget_order: layout.order,
      },
    }),
  })
  persistLocalFallback([], layout.order)
}

export function PanelWidgetProvider({
  children,
  initialHidden = [],
  initialOrder = DEFAULT_PANEL_WIDGET_ORDER,
}: {
  children: React.ReactNode
  initialHidden?: PanelWidgetId[]
  initialOrder?: PanelWidgetId[]
}) {
  const [hiddenIds, setHiddenIds] = useState<PanelWidgetId[]>(initialHidden)
  const [widgetOrder, setWidgetOrder] = useState<PanelWidgetId[]>(() => normalizePanelWidgetOrder(initialOrder))
  const [ready, setReady] = useState(initialHidden.length > 0 || initialOrder.length > 0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePersist = useCallback((layout: PanelLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      persistRemote(layout).catch(() => persistLocalFallback(layout.hidden, layout.order))
    }, 350)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchJson<PreferencesResponse>('/api/v1/me/preferences')
        if (cancelled) return

        const fromApiHidden = res.preferences?.panel?.hidden_widgets ?? []
        const fromApiOrder = normalizePanelWidgetOrder(res.preferences?.panel?.widget_order)

        if (fromApiHidden.length > 0 || (res.preferences?.panel?.widget_order?.length ?? 0) > 0) {
          setHiddenIds(fromApiHidden)
          setWidgetOrder(fromApiOrder)
          return
        }

        const fromLocalHidden = parseHiddenPanelWidgets(localStorage.getItem(PANEL_WIDGETS_STORAGE_KEY))
        const fromLocalOrder = parseLocalWidgetOrder()
        if (fromLocalHidden.length > 0) {
          setHiddenIds(fromLocalHidden)
          setWidgetOrder(fromLocalOrder)
          await persistRemote({ hidden: fromLocalHidden, order: fromLocalOrder })
        }
      } catch {
        if (cancelled) return
        const fromLocalHidden = parseHiddenPanelWidgets(localStorage.getItem(PANEL_WIDGETS_STORAGE_KEY))
        const fromLocalOrder = parseLocalWidgetOrder()
        if (fromLocalHidden.length > 0) setHiddenIds(fromLocalHidden)
        setWidgetOrder(fromLocalOrder)
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const applyLayout = useCallback((layout: PanelLayout) => {
    const nextHidden = layout.hidden
    const nextOrder = normalizePanelWidgetOrder(layout.order)
    setHiddenIds(nextHidden)
    setWidgetOrder(nextOrder)
    schedulePersist({ hidden: nextHidden, order: nextOrder })
  }, [schedulePersist])

  const hide = useCallback((id: PanelWidgetId) => {
    setHiddenIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      schedulePersist({ hidden: next, order: widgetOrder })
      return next
    })
  }, [schedulePersist, widgetOrder])

  const show = useCallback((id: PanelWidgetId) => {
    setHiddenIds(prev => {
      const next = prev.filter(w => w !== id)
      schedulePersist({ hidden: next, order: widgetOrder })
      return next
    })
  }, [schedulePersist, widgetOrder])

  const resetAll = useCallback(() => {
    applyLayout({ hidden: [], order: widgetOrder })
  }, [applyLayout, widgetOrder])

  const isHidden = useCallback((id: PanelWidgetId) => hiddenIds.includes(id), [hiddenIds])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  const value = useMemo<PanelWidgetContextValue>(() => ({
    ready,
    hiddenIds,
    widgetOrder,
    isHidden,
    hide,
    show,
    resetAll,
    applyLayout,
    hasHidden: hiddenIds.length > 0,
    hiddenCount: hiddenIds.length,
  }), [ready, hiddenIds, widgetOrder, isHidden, hide, show, resetAll, applyLayout])

  return (
    <PanelWidgetContext.Provider value={value}>
      {children}
    </PanelWidgetContext.Provider>
  )
}

export function usePanelWidgets(): PanelWidgetContextValue {
  const ctx = useContext(PanelWidgetContext)
  if (!ctx) {
    throw new Error('usePanelWidgets must be used within PanelWidgetProvider')
  }
  return ctx
}

export function usePanelWidgetsOptional(): PanelWidgetContextValue {
  const ctx = useContext(PanelWidgetContext)
  if (ctx) return ctx
  return {
    ready: true,
    hiddenIds: [],
    widgetOrder: [...DEFAULT_PANEL_WIDGET_ORDER],
    isHidden: () => false,
    hide: () => {},
    show: () => {},
    resetAll: () => {},
    applyLayout: () => {},
    hasHidden: false,
    hiddenCount: 0,
  }
}
