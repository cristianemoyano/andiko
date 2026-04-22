'use client'
import { useState, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'

function formatARS(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const num = Number(value)
  if (isNaN(num)) return ''
  const [intPart, decPart] = num.toFixed(2).split('.')
  const thousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$ ${thousands},${decPart}`
}

function parseEditValue(raw: string): string {
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? '' : num.toFixed(2)
}

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string | number | null | undefined
  onChange: (value: string) => void
  error?: boolean
}

const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, error, className, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const [editValue, setEditValue] = useState('')

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const num = Number(value)
        setEditValue(isNaN(num) || value === '' || value === null || value === undefined
          ? ''
          : num.toFixed(2).replace('.', ','))
        setFocused(true)
        setTimeout(() => e.target.select(), 0)
        onFocus?.(e)
      },
      [value, onFocus],
    )

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setFocused(false)
        onChange(parseEditValue(editValue))
        onBlur?.(e)
      },
      [editValue, onChange, onBlur],
    )

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={focused ? editValue : formatARS(value)}
          onChange={e => setEditValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            'flex h-8 w-full rounded-sm border bg-white px-2.5 text-[13px] text-zinc-900 transition-colors text-right tabular-nums',
            'placeholder:text-zinc-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
            'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400',
            error
              ? 'border-red-500 focus-visible:ring-red-200'
              : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'

export { CurrencyInput, formatARS }
