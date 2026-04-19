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

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyMessage?: string
  className?: string
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  toolbar,
  footer,
  emptyMessage = 'Sin registros.',
  className,
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
    if (!sortKey || !sortDir) return data
    return [...data].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      const cmp = av.localeCompare(bv, 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return (
    <div className={cn('bg-white border border-zinc-200 rounded', className)}>
      {toolbar && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200">
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={cn(
                    'h-9 px-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 bg-zinc-50 whitespace-nowrap select-none',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:bg-zinc-100 hover:text-zinc-800',
                    sortKey === col.key && 'text-brand-600 bg-brand-50',
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
                  className="h-20 text-center text-sm text-zinc-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => (
                <tr
                  key={keyExtractor(row)}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors"
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'h-10 px-3 text-[13px] text-zinc-900',
                        col.align === 'right' && 'text-right',
                        col.className
                      )}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer && (
        <div className="px-3 py-2.5 border-t border-zinc-100 flex items-center justify-end gap-4 text-[12px] text-zinc-500">
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
        className={cn('block', active && dir === 'asc' ? 'text-brand-600' : 'text-zinc-300')}
      >
        <path d="M3.5 0L7 4H0z" fill="currentColor" />
      </svg>
      <svg
        width="7" height="4" viewBox="0 0 7 4"
        className={cn('block', active && dir === 'desc' ? 'text-brand-600' : 'text-zinc-300')}
      >
        <path d="M3.5 4L0 0h7z" fill="currentColor" />
      </svg>
    </span>
  )
}
