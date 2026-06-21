'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/primitives/DropdownMenu'
import { cn } from '@/lib/utils'
import { PANEL_WIDGETS, type PanelWidgetId } from '@/modules/panel/panel-widget.types'
import { usePanelWidgetsOptional } from './PanelWidgetProvider'

export interface PanelWidgetMenuProps {
  widgetId: PanelWidgetId
  className?: string
}

function IconEllipsis() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

/** WooCommerce-style widget menu — hides the card from the panel. */
export function PanelWidgetMenu({ widgetId, className }: PanelWidgetMenuProps) {
  const { hide } = usePanelWidgetsOptional()
  const label = PANEL_WIDGETS[widgetId].label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Opciones de ${label}`}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-fg-subtle hover:text-fg hover:bg-surface-hover transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
            className,
          )}
        >
          <IconEllipsis />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => hide(widgetId)}>
          Ocultar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
