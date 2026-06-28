'use client'

import { useEffect, useMemo, useState } from 'react'

export interface TableColumnOption {
  key: string
  label: string
  /** Defaults to true when omitted. */
  defaultVisible?: boolean
}

function defaultVisibleKeys(options: TableColumnOption[]): string[] {
  return options.filter(o => o.defaultVisible !== false).map(o => o.key)
}

function readStoredKeys(storageKey: string, options: TableColumnOption[]): string[] {
  const defaults = defaultVisibleKeys(options)
  const validKeys = new Set(options.map(o => o.key))
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return defaults
    const filtered = parsed.filter((k): k is string => typeof k === 'string' && validKeys.has(k))
    return filtered.length > 0 ? filtered : defaults
  } catch {
    return defaults
  }
}

/** Persists visible table column keys in localStorage, preserving definition order. */
export function usePersistedTableColumns(storageKey: string, options: TableColumnOption[]) {
  const defaults = useMemo(() => defaultVisibleKeys(options), [options])
  const order = useMemo(() => options.map(o => o.key), [options])

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => readStoredKeys(storageKey, options))

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(visibleKeys))
  }, [storageKey, visibleKeys])

  function sortByDefinition(keys: string[]): string[] {
    const set = new Set(keys)
    return order.filter(key => set.has(key))
  }

  function toggleColumn(key: string) {
    setVisibleKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter(k => k !== key)
      }
      return sortByDefinition([...prev, key])
    })
  }

  function resetColumns() {
    setVisibleKeys(defaults)
  }

  return { visibleKeys, toggleColumn, resetColumns, setVisibleKeys }
}

export function filterColumnsByVisibility<T extends { key: string }>(
  columns: T[],
  visibleKeys: string[],
): T[] {
  const visible = new Set(visibleKeys)
  return columns.filter(col => visible.has(col.key))
}
