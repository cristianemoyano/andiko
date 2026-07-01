'use client'

import { cn } from '@/lib/utils'
import { type MobileColumnRole } from './DataTable'
import { Checkbox } from '@/components/primitives/Checkbox'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/primitives/DropdownMenu'
import {
  SELECT_COL_CLASS,
  SelectionHeaderCell,
  SelectionRowCell,
  type TableRowSelection,
} from './table-selection'

export type { TableRowSelection } from './table-selection'

export interface GroupedColumn<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  /** Mobile-only renderer for actions columns. Return DropdownMenuItem elements. */
  mobileRender?: (row: T) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
  mobileRole?: MobileColumnRole
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
  getParentRowProps?: (row: P) => React.HTMLAttributes<HTMLTableRowElement>
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyMessage?: string
  className?: string
  /** Render card list on viewports below md. Default true. */
  mobileList?: boolean
  /** Optional row selection (checkbox column on parent rows). */
  selection?: TableRowSelection
}

function renderGroupedCell<T extends object>(col: GroupedColumn<T>, row: T): React.ReactNode {
  return col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')
}

function GroupedMobileCard<P extends object>({
  row,
  rowId,
  columns,
  onActivate,
  selection,
}: {
  row: P
  rowId: string
  columns: GroupedColumn<P>[]
  onActivate?: () => void
  selection?: TableRowSelection
}) {
  const byRole = (role: MobileColumnRole) =>
    columns.filter(c => c.mobileRole === role).map(c => renderGroupedCell(c, row))

  const titleContent = byRole('title')[0]
  const subtitleContents = byRole('subtitle')
  const badge = byRole('badge')[0]
  const amount = byRole('amount')[0]

  const actionsColumns = columns.filter(c => c.mobileRole === 'actions')
  const actionsMenuContent = actionsColumns.find(c => c.mobileRender)?.mobileRender?.(row) ?? null
  const actionsLegacy = actionsColumns
    .filter(c => !c.mobileRender)
    .map(c => renderGroupedCell(c, row))
  const hasActions = actionsMenuContent !== null || actionsLegacy.length > 0

  return (
    <div
      role={onActivate ? 'link' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={
        onActivate
          ? e => {
              const t = e.target as HTMLElement | null
              if (t?.closest('button, a, [role="button"], [data-stop-row-click]')) return
              onActivate()
            }
          : undefined
      }
      onKeyDown={
        onActivate
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onActivate()
              }
            }
          : undefined
      }
      className={cn(
        'relative block w-full text-left px-4 py-3.5 transition-colors',
        hasActions ? 'pr-12' : '',
        onActivate && 'cursor-pointer hover:bg-surface-muted active:bg-surface-muted',
      )}
    >
      <div className="flex items-start gap-3">
        {selection && (
          <span className="flex h-[19px] items-center shrink-0" data-stop-row-click>
            <Checkbox
              checked={selection.selectedIds.has(rowId)}
              onCheckedChange={() => selection.onToggleRow(rowId)}
              aria-label="Seleccionar fila"
            />
          </span>
        )}
        <div className="flex-1 min-w-0">
          {titleContent && (
            <div className="text-fg leading-snug">{titleContent}</div>
          )}
          {subtitleContents.length > 0 && (
            <div className="mt-0.5 text-[13px] text-fg-muted truncate">
              {subtitleContents.map((node, i) => (
                <span key={i}>{i > 0 ? ' · ' : null}{node}</span>
              ))}
            </div>
          )}
          {badge && <div className="mt-2">{badge}</div>}
        </div>
        {(amount || onActivate) && (
          <div className="flex items-center gap-1.5 shrink-0 min-w-0 mt-0.5">
            {amount && (
              <span className="text-[15px] font-semibold text-fg tabular-nums">{amount}</span>
            )}
            {onActivate && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg-subtle shrink-0"
                aria-hidden
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        )}
      </div>

      {hasActions && (
        <div className="absolute top-2 right-2" data-stop-row-click>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Acciones"
                className="flex items-center justify-center w-8 h-8 rounded-md text-fg-subtle hover:bg-surface-hover transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actionsMenuContent ?? (
                <div className="[&_button]:!flex [&_button]:!w-full [&_button]:!justify-start [&_button]:!h-auto [&_button]:!text-[13px] [&_button]:!py-1.5 [&_button]:!px-2.5 [&_button]:!font-normal [&_button]:!rounded-[3px]">
                  {actionsLegacy.map((node, i) => (
                    <div key={i}>{node}</div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

export function GroupedDataTable<P extends object, C extends object>({
  parentColumns,
  childColumns,
  groups,
  parentKey,
  childKey,
  onRowClick,
  getParentRowProps,
  toolbar,
  footer,
  emptyMessage = 'Sin registros.',
  className,
  mobileList = true,
  selection,
}: GroupedDataTableProps<P, C>) {
  return (
    <div className={cn('bg-surface border border-border rounded', className)}>
      {toolbar && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          {toolbar}
        </div>
      )}

      {mobileList && (
        <div className="md:hidden divide-y divide-border">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-fg-subtle">{emptyMessage}</div>
          ) : (
            groups.map(({ parent }) => (
              <GroupedMobileCard
                key={parentKey(parent)}
                rowId={parentKey(parent)}
                row={parent}
                columns={parentColumns}
                onActivate={onRowClick ? () => onRowClick(parent) : undefined}
                selection={selection}
              />
            ))
          )}
        </div>
      )}

      <div className={cn('overflow-x-auto', mobileList && 'hidden md:block')}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {selection && <SelectionHeaderCell selection={selection} />}
              {parentColumns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'h-9 px-3 text-left text-[11px] font-semibold text-fg-muted uppercase tracking-wide border-b border-border bg-surface-muted whitespace-nowrap select-none',
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
                <td colSpan={parentColumns.length + (selection ? 1 : 0)} className="h-20 text-center text-sm text-fg-subtle">
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
                    onClick={onRowClick ? (e) => {
                      const t = e.target as HTMLElement | null
                      if (t?.closest('[data-stop-row-click]')) return
                      onRowClick(parent)
                    } : undefined}
                    {...getParentRowProps?.(parent)}
                    className={cn(
                      'group border-b border-border last:border-0 hover:bg-surface-muted transition-colors',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {selection && (
                      <SelectionRowCell
                        id={parentKey(parent)}
                        selection={selection}
                        label={`Seleccionar ${String((parent as Record<string, unknown>).name ?? 'producto')}`}
                      />
                    )}
                    {parentColumns.map(col => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 text-[13px] text-fg align-middle',
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
                            onClick={onRowClick ? (e) => {
                              const t = e.target as HTMLElement | null
                              if (t?.closest('[data-stop-row-click]')) return
                              onRowClick(parent)
                            } : undefined}
                            className={cn(
                              'border-b border-border last:border-0 bg-surface-muted/50 hover:bg-surface-hover/40 transition-colors',
                              onRowClick && 'cursor-pointer',
                            )}
                          >
                            {selection && <td className={cn('align-middle', SELECT_COL_CLASS)} />}
                            {childColumns.map((col, ci2) => (
                              <td
                                key={col.key}
                                className={cn(
                                  'px-3 py-2 text-[13px] text-fg-muted align-middle',
                                  col.align === 'right' && 'text-right',
                                  col.className,
                                )}
                              >
                                {ci2 === 0 ? (
                                  // First cell: indent + tree connector
                                  <span className="flex items-center gap-1.5 pl-4">
                                    <span className="text-fg-subtle text-[11px] select-none font-mono leading-none">
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
        <div className="px-3 py-2.5 border-t border-border flex items-center justify-end gap-4 text-[12px] text-fg-muted">
          {footer}
        </div>
      )}
    </div>
  )
}
