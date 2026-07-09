'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/primitives/Checkbox'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/primitives/DropdownMenu'
import {
  SelectionHeaderCell,
  SelectionRowCell,
  type TableRowSelection,
} from './table-selection'

export type { TableRowSelection } from './table-selection'

export type MobileColumnRole = 'lead' | 'prefix' | 'title' | 'subtitle' | 'badge' | 'amount' | 'actions' | 'hidden'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  /** Mobile-only renderer for actions columns. Return DropdownMenuItem elements; they render
   *  directly inside DropdownMenuContent with full keyboard nav and auto-close. When omitted
   *  for an 'actions' column, falls back to the CSS-override approach. */
  mobileRender?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right'
  className?: string
  /** Mobile list layout (WooCommerce-style). Inferred from column key when omitted. */
  mobileRole?: MobileColumnRole
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
  /** Pin the first column while the table scrolls horizontally — useful for wide tables on desktop. */
  stickyFirstColumn?: boolean
  /** Render card list on viewports below md. Default true. */
  mobileList?: boolean
  /** Optional row selection (checkbox column aligned in header). */
  selection?: TableRowSelection
}

type SortDir = 'asc' | 'desc' | null

const LEAD_KEYS = ['created_at', 'issue_date', 'fecha', 'payment_date', 'invoice_date', 'updated_at']
const AMOUNT_KEYS = ['total', 'amount', 'balance', 'monto', 'paid_amount']
const BADGE_KEYS = ['status', 'estado']
const TITLE_KEYS = ['contact', 'cliente', 'customer', 'legal_name', 'name', 'supplier', 'proveedor']
const PREFIX_KEYS = ['number', 'numero', 'quote_number', 'order_number', 'invoice_number', 'payment_number', 'receipt_number']
const SUBTITLE_KEYS = ['branch', 'sucursal', 'payment_condition', 'condicion', 'salesperson', 'vendedor', 'category', 'categoria']

function inferMobileRole(column: Column<unknown>): MobileColumnRole {
  if (column.mobileRole) return column.mobileRole

  const key = column.key.toLowerCase()

  if (LEAD_KEYS.some(k => key === k || key.endsWith(`_${k}`) || key.includes(k))) return 'lead'
  if (AMOUNT_KEYS.some(k => key === k || key.includes(k))) return 'amount'
  if (BADGE_KEYS.some(k => key === k || key.includes(k))) return 'badge'
  if (PREFIX_KEYS.some(k => key.includes(k))) return 'prefix'
  if (TITLE_KEYS.some(k => key === k || key.includes(k))) return 'title'
  if (SUBTITLE_KEYS.some(k => key === k || key.includes(k))) return 'subtitle'
  if (key === '_actions' || key.startsWith('_actions')) return 'actions'

  return 'hidden'
}

function renderCell<T extends object>(column: Column<T>, row: T): React.ReactNode {
  return column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '')
}

function hasContent(content: React.ReactNode): boolean {
  if (content === null || content === undefined || content === false) return false
  if (typeof content === 'string') return content.length > 0
  return true
}

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
  mobileList = true,
  selection,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const mobileColumns = useMemo(
    () =>
      columns.map(col => ({
        col,
        role: inferMobileRole(col as Column<unknown>),
      })),
    [columns],
  )

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

  function handleRowClick(row: T, e: React.MouseEvent) {
    if (!onRowClick) return
    const target = e.target as HTMLElement | null
    const interactive = target?.closest('button, a, input, select, textarea, [role="button"], [data-stop-row-click]')
    if (interactive) return
    onRowClick(row)
  }

  return (
    <div className={cn('bg-surface border border-border rounded', className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-3 md:py-2.5 border-b border-border">
          {toolbar}
        </div>
      )}

      {mobileList && (
        <div className="md:hidden divide-y divide-border">
          {sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-fg-subtle">{emptyMessage}</div>
          ) : (
            sorted.map(row => (
              <MobileListRow
                key={keyExtractor(row)}
                row={row}
                rowId={keyExtractor(row)}
                mobileColumns={mobileColumns}
                onActivate={onRowClick ? () => onRowClick(row) : undefined}
                selection={selection}
              />
            ))
          )}
        </div>
      )}

      <div className={cn('overflow-x-auto overscroll-x-contain [scrollbar-width:thin]', mobileList && 'hidden md:block')}>
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              {selection && <SelectionHeaderCell selection={selection} />}
              {columns.map((col, i) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={cn(
                    'h-9 px-3 text-left text-[11px] font-semibold text-fg-muted uppercase tracking-wide border-b border-border bg-surface-muted whitespace-nowrap select-none',
                    col.align === 'right' && 'text-right',
                    col.sortable && 'cursor-pointer hover:bg-surface-hover hover:text-fg',
                    sortKey === col.key && 'text-brand-accent bg-brand-accent-bg',
                    stickyFirstColumn && i === 0 && !selection && 'sticky left-0 z-10 bg-surface-muted',
                    col.className,
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="h-20 text-center text-sm text-fg-subtle">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map(row => {
                const rowId = keyExtractor(row)
                return (
                <tr
                  key={rowId}
                  onClick={onRowClick ? e => handleRowClick(row, e) : undefined}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-surface-muted transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {selection && (
                    <SelectionRowCell
                      id={rowId}
                      selection={selection}
                      label="Seleccionar fila"
                      disabled={selection.disabledIds?.has(rowId)}
                    />
                  )}
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={cn(
                        'h-10 px-3 text-[13px] text-fg',
                        col.align === 'right' && 'text-right',
                        stickyFirstColumn && i === 0 && !selection && 'sticky left-0 z-10 bg-surface',
                        col.className,
                      )}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
                )
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

interface MobileListRowProps<T extends object> {
  row: T
  rowId: string
  mobileColumns: { col: Column<T>; role: MobileColumnRole }[]
  onActivate?: () => void
  selection?: TableRowSelection
}

function MobileListRow<T extends object>({ row, rowId, mobileColumns, onActivate, selection }: MobileListRowProps<T>) {
  const byRole = (role: MobileColumnRole) =>
    mobileColumns.filter(item => item.role === role).map(item => renderCell(item.col, row))

  const lead = byRole('lead')[0]
  const prefixContent = byRole('prefix')[0]
  const titleContent = byRole('title')[0]
  const subtitleContents = byRole('subtitle')
  const badge = byRole('badge')[0]
  const amount = byRole('amount')[0]

  // Actions: prefer mobileRender (DropdownMenuItems, proper keyboard nav) over the CSS fallback
  const actionsColumns = mobileColumns.filter(item => item.role === 'actions')
  const actionsMenuContent = actionsColumns.find(item => item.col.mobileRender)
    ?.col.mobileRender?.(row) ?? null
  const actionsLegacy = actionsColumns
    .filter(item => !item.col.mobileRender)
    .map(item => renderCell(item.col, row))
  const hasActions = actionsMenuContent !== null || actionsLegacy.length > 0

  const titleLine =
    hasContent(prefixContent) && hasContent(titleContent) ? (
      <>
        <span className="font-mono text-[13px] text-fg-muted">{prefixContent}</span>{' '}
        <span>{titleContent}</span>
      </>
    ) : (
      titleContent ?? prefixContent
    )

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
        'relative block w-full text-left py-3.5 transition-colors',
        hasActions ? 'pr-10' : 'pr-4',
        selection ? 'pl-4' : 'pl-4',
        onActivate && 'cursor-pointer hover:bg-surface-muted active:bg-surface-muted',
      )}
    >
      <div className="flex items-start gap-3">
        {selection && (
          <span className="flex h-[19px] items-center shrink-0" data-stop-row-click>
            <Checkbox
              checked={selection.selectedIds.has(rowId)}
              onCheckedChange={() => selection.onToggleRow(rowId)}
              disabled={selection.disabledIds?.has(rowId)}
              aria-label="Seleccionar fila"
            />
          </span>
        )}
        <div className="flex-1 min-w-0">
      {(lead || amount) && (
        <div className="flex items-start justify-between gap-3 mb-1">
          <span className="text-[12px] text-fg-subtle tabular-nums shrink-0">{lead}</span>
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            {amount && (
              <span className="text-[15px] font-semibold text-fg tabular-nums truncate">{amount}</span>
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
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        </div>
      )}

      {hasContent(titleLine) && (
        <p className="text-[14px] font-medium text-fg leading-snug line-clamp-2">{titleLine}</p>
      )}

      {subtitleContents.length > 0 && (
        <div className="mt-0.5 text-[13px] text-fg-muted truncate">
          {subtitleContents.map((node, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : null}
              {node}
            </span>
          ))}
        </div>
      )}

      {badge && <div className="mt-2">{badge}</div>}
        </div>
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="inline-flex flex-col gap-px">
      <svg
        width="7" height="4" viewBox="0 0 7 4"
        className={cn('block', active && dir === 'asc' ? 'text-brand-accent' : 'text-fg-subtle')}
      >
        <path d="M3.5 0L7 4H0z" fill="currentColor" />
      </svg>
      <svg
        width="7" height="4" viewBox="0 0 7 4"
        className={cn('block', active && dir === 'desc' ? 'text-brand-accent' : 'text-fg-subtle')}
      >
        <path d="M3.5 4L0 0h7z" fill="currentColor" />
      </svg>
    </span>
  )
}
