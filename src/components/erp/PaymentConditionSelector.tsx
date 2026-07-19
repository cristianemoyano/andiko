'use client'

import { cn } from '@/lib/utils'
import type { PaymentCondition } from '@/types'

const PAYMENT_CONDITION_LABEL: Record<PaymentCondition, string> = {
  cash:   'Contado',
  net_30: '30 días',
  net_60: '60 días',
  net_90: '90 días',
}

const PAYMENT_CONDITIONS = Object.entries(PAYMENT_CONDITION_LABEL).map(([value, label]) => ({
  value: value as PaymentCondition,
  label,
}))

export interface PaymentConditionSelectorProps {
  value: PaymentCondition
  onChange: (value: PaymentCondition) => void
  disabled?: boolean
  className?: string
}

/** Chips de condición de pago compartidos por presupuestos, pedidos y facturas. */
export function PaymentConditionSelector({ value, onChange, disabled, className }: PaymentConditionSelectorProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {PAYMENT_CONDITIONS.map(pc => (
        <button
          key={pc.value}
          type="button"
          onClick={() => onChange(pc.value)}
          disabled={disabled}
          aria-pressed={value === pc.value}
          className={cn(
            'h-9 px-3.5 text-[13px] rounded-sm border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
            value === pc.value
              ? 'border-brand-accent bg-brand-accent-bg text-brand-accent font-semibold'
              : 'border-border-strong text-fg-muted hover:bg-surface-hover hover:text-fg',
          )}
        >
          {pc.label}
        </button>
      ))}
    </div>
  )
}
