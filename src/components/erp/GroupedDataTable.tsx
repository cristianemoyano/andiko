'use client'

import { cn } from '@/lib/utils'

export interface GroupedColumn<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

export interface RowGroup<P extends object, C extends object> {
  parent: P
  children?: C[]
}

interface GroupedDataTableProps<P extends object, C extends object> {
  /** Column definitions for parent rows */
  parentColumns: GroupedColumn<P>[]
  /** Column definitions for child rows — must match parentColumns length */
  childColumns: GroupedColumn<C>[]
  groups: RowGroup<P, C>[]
  parentKey: (row: P) => string
  childKey: (row: C) => string
  onRowClick?: (row: P) => void
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyMessage?: string
  className?: string
}

export function GroupedDataTable<P extends object, C extends object>({
  parentColumns,
  childColumns,
  groups,
  parentKey,
  childKey,
  onRowClick,
  toolbar,
  footer,
  emptyMessage = 'Sin registros.',
  className,
}: GroupedDataTableProps<P, C>) {
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
              {parentColumns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'h-9 px-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide border-b border-zinc-200 bg-zinc-50 whitespace-nowrap select-none',
                    col.align === 'right' && 'text-right',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={parentColumns.length} className="h-20 text-center text-sm text-zinc-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              groups.map(({ parent, children = [] }) => {
                const hasChildren = children.length > 1
                return [
                  // ── Parent row ──────────────────────────────────────────
                  <tr
                    key={parentKey(parent)}
                    onClick={onRowClick ? () => onRowClick(parent) : undefined}
                    className={cn(
                      'border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {parentColumns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 text-[13px] text-zinc-900 align-middle',
                          col.align === 'right' && 'text-right',
                          col.className,
                        )}
                      >
                        {col.render ? col.render(parent) : String((parent as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>,

                  // ── Child rows (only when >1 variant) ───────────────────
                  ...(hasChildren
                    ? children.map((child, ci) => {
                        const isLast = ci === children.length - 1
                        return (
                          <tr
                            key={childKey(child)}
                            onClick={onRowClick ? () => onRowClick(parent) : undefined}
                            className={cn(
                              'border-b border-zinc-100 last:border-0 bg-zinc-50/50 hover:bg-blue-50/30 transition-colors',
                              onRowClick && 'cursor-pointer',
                            )}
                          >
                            {childColumns.map((col, ci2) => (
                              <td
                                key={col.key}
                                className={cn(
                                  'px-3 py-2 text-[13px] text-zinc-700 align-middle',
                                  col.align === 'right' && 'text-right',
                                  col.className,
                                )}
                              >
                                {ci2 === 0 ? (
                                  // First cell: indent + tree connector
                                  <span className="flex items-center gap-1.5 pl-4">
                                    <span className="text-zinc-300 text-[11px] select-none font-mono leading-none">
                                      {isLast ? '└' : '├'}
                                    </span>
                                    <span>{col.render ? col.render(child) : String((child as Record<string, unknown>)[col.key] ?? '')}</span>
                                  </span>
                                ) : (
                                  col.render ? col.render(child) : String((child as Record<string, unknown>)[col.key] ?? '')
                                )}
                              </td>
                            ))}
                          </tr>
                        )
                      })
                    : []),
                ]
              })
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
