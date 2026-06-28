'use client'

import { Button } from '@/components/primitives/Button'

export interface StreamProgressPanelProps {
  title: string
  unitLabel: string
  processed: number
  total: number
  eta?: string | null
  hint?: string
  onCancel?: () => void
  cancelLabel?: string
}

export function StreamProgressPanel({
  title,
  unitLabel,
  processed,
  total,
  eta = null,
  hint,
  onCancel,
  cancelLabel = 'Cancelar',
}: StreamProgressPanelProps) {
  const progressPct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
  const counterLabel = total > 0
    ? `${processed.toLocaleString('es-AR')} / ${total.toLocaleString('es-AR')} ${unitLabel} (${progressPct}%)`
    : 'Preparando…'

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface-muted/50 p-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-fg">{title}</span>
        <span className="text-fg-muted tabular-nums">
          {counterLabel}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: total > 0 ? `${Math.max(progressPct, processed > 0 ? 3 : 0)}%` : '0%' }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {(hint || eta) && (
          <p className="text-[12px] text-fg-muted min-w-0 flex-1">
            {hint ?? 'Procesando en el servidor.'}
            {eta ? ` ${eta}.` : ''}
          </p>
        )}
        {onCancel && (
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
