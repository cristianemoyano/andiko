'use client'

import { Button } from '@/components/primitives/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import type { TableColumnOption } from '@/lib/use-persisted-table-columns'

export interface TableColumnPickerProps {
  options: TableColumnOption[]
  visibleKeys: string[]
  onToggle: (key: string) => void
  onReset?: () => void
}

/** Checkbox panel to show/hide optional DataTable columns (WooCommerce-style screen options). */
export function TableColumnPicker({ options, visibleKeys, onToggle, onReset }: TableColumnPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-[30px] px-2" aria-label="Configurar columnas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-3" onCloseAutoFocus={e => e.preventDefault()}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle px-1 mb-2">
          Columnas
        </p>
        <div className="flex flex-col gap-0.5" onPointerDown={e => e.stopPropagation()}>
          {options.map(opt => {
            const checked = visibleKeys.includes(opt.key)
            const onlyVisible = checked && visibleKeys.length === 1
            return (
              <label
                key={opt.key}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[13px] text-fg cursor-pointer hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  className="rounded border-border-strong"
                  checked={checked}
                  disabled={onlyVisible}
                  onChange={() => onToggle(opt.key)}
                />
                {opt.label}
              </label>
            )
          })}
        </div>
        {onReset ? (
          <button
            type="button"
            className="mt-2 w-full text-left px-2 py-1 text-[12px] text-brand-600 hover:underline"
            onClick={onReset}
          >
            Restaurar predeterminadas
          </button>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
