'use client'

import { Checkbox } from '@/components/primitives/Checkbox'
import { cn } from '@/lib/utils'

export interface TableRowSelection {
  selectedIds: Set<string>
  onToggleRow: (id: string) => void
  onToggleAllOnPage: () => void
  /** Row ids on the current page (for header checkbox state). */
  pageIds: string[]
  /** Row ids that cannot be selected (e.g. zero stock). */
  disabledIds?: Set<string>
}

export const SELECT_COL_CLASS = 'w-10 px-2'

export function SelectionHeaderCell({ selection }: { selection: TableRowSelection }) {
  const { pageIds, selectedIds, disabledIds } = selection
  const selectableIds = disabledIds
    ? pageIds.filter(id => !disabledIds.has(id))
    : pageIds
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id))
  const someSelected = selectableIds.some(id => selectedIds.has(id))
  return (
    <th
      className={cn(
        'h-9 text-left text-[11px] font-semibold text-fg-muted uppercase tracking-wide border-b border-border bg-surface-muted whitespace-nowrap select-none',
        SELECT_COL_CLASS,
      )}
    >
      <Checkbox
        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
        onCheckedChange={() => selection.onToggleAllOnPage()}
        disabled={selectableIds.length === 0}
        aria-label="Seleccionar todos en la página"
      />
    </th>
  )
}

export function SelectionRowCell({
  id,
  selection,
  label,
  disabled = false,
}: {
  id: string
  selection: TableRowSelection
  label: string
  disabled?: boolean
}) {
  return (
    <td className={cn('h-10 align-middle', SELECT_COL_CLASS)} data-stop-row-click>
      <Checkbox
        checked={selection.selectedIds.has(id)}
        onCheckedChange={() => selection.onToggleRow(id)}
        disabled={disabled}
        aria-label={label}
      />
    </td>
  )
}
