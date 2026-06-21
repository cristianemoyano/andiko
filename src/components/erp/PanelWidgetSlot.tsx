'use client'

import { usePanelWidgetsOptional } from './PanelWidgetProvider'
import type { PanelWidgetId } from '@/modules/panel/panel-widget.types'

export interface PanelWidgetSlotProps {
  widgetId: PanelWidgetId
  children: React.ReactNode
  className?: string
}

/** Renders a panel widget when it is not hidden for this user. */
export function PanelWidgetSlot({ widgetId, children, className }: PanelWidgetSlotProps) {
  const { isHidden } = usePanelWidgetsOptional()

  if (isHidden(widgetId)) return null

  return <div className={className}>{children}</div>
}
