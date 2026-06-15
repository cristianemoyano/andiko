'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right'
  className?: string
}

interface DataTableProps<T extends object> {
  columns: Column<T>[]
  data?: T[] | null
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyMessage?: string
  className?: string
  /** Pin the first column while the table scrolls horizontally — useful for wide tables on mobile. */
  stickyFirstColumn?: boolean
}

type SortDir = 'asc' | 'desc' | null

/** Domain row types need not be index signatures; dynamic columns use a narrow cast internally. */
export function DataTable<T extends object>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  toolbar,
  footer,
  emptyMessage = 'Sin registros.',
  className,
  stickyFirstColumn = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
      setSortDir(null)
    }
  }

  const sorted = useMemo(() => {
    const safeData = Array.isArray(data) ? data : []
    if (!sortKey || !sortDir) return safeData
    return [...safeData].sort((a, b) => {
      const ra = a as Record<string, unknown>
      const rb = b as Record<string, unknown>
      const av = String(ra[sortKey] ?? '')
      const bv = String(rb[sortKey] ?? '')
      const cmp = av.localeCompare(bv, 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return (
    <div className={cn('bg-surface border border-border rounded', className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border">
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={cn(
                    'h-9 px-3 text-left text-[11px] font-semibold text-fg-muted uppercase tracking-wide border-b border-border bg-surface-muted whitespace-nowrap select-none',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:bg-surface-hover hover:text-fg',
                    sortKey === col.key && 'text-brand-600 bg-brand-50',
                    stickyFirstColumn && i === 0 && 'sticky left-0 z-10 bg-surface-muted',
                    col.className
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-20 text-center text-sm text-fg-subtle"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr
                  key={keyExtractor(row)}
                  onClick={
                    onRowClick
                      ? (e) => {
                          const target = e.target as HTMLElement | null
                          const interactive = target?.closest('button, a, input, select, textarea, [role="button"], [data-stop-row-click]')
                          if (interactive) return
                          onRowClick(row)
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-surface-muted transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={cn(
                        'h-10 px-3 text-[13px] text-fg',
                        col.align === 'right' && 'text-right',
                        stickyFirstColumn && i === 0 && 'sticky left-0 z-10 bg-surface',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="px-3 py-2.5 border-t border-border flex items-center justify-end gap-4 text-[12px] text-fg-muted">
          {footer}
        </div>
      )}
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="inline-flex flex-col gap-px">
      <svg
        width="7" height="4" viewBox="0 0 7 4"
        className={cn('block', active && dir === 'asc' ? 'text-brand-600' : 'text-fg-subtle')}
      >
        <path d="M3.5 0L7 4H0z" fill="currentColor" />
      </svg>
      <svg
        width="7" height="4" viewBox="0 0 7 4"
        className={cn('block', active && dir === 'desc' ? 'text-brand-600' : 'text-fg-subtle')}
      >
        <path d="M3.5 4L0 0h7z" fill="currentColor" />
      </svg>
    </span>
  )
}
