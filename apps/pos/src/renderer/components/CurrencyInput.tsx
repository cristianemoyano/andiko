import { useState, useCallback, forwardRef } from 'react'

export function formatARS(value: string | number | null | undefined): string {
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
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, onFocus, onBlur, ...props }, ref) => {
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
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={focused ? editValue : formatARS(value)}
        onChange={e => setEditValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className}
        {...props}
      />
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
