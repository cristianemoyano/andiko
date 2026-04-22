'use client'
import { useState, useEffect, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'

function dateToDisplay(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ''
  const day   = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

function parseDisplay(text: string): Date | null {
  const parts = text.split('/')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)
  if (!day || !month || !year || year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCDate() !== day || d.getUTCMonth() + 1 !== month || d.getUTCFullYear() !== year) return null
  return d
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: Date | string | null | undefined
  onChange: (date: Date | null) => void
  error?: boolean
}

const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, error, className, onFocus, onBlur, placeholder = 'DD/MM/AAAA', ...props }, ref) => {
    const [text, setText] = useState(() => dateToDisplay(value))
    const [focused, setFocused] = useState(false)

    useEffect(() => {
      if (!focused) setText(dateToDisplay(value))
    }, [value, focused])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setText(applyMask(e.target.value))
    }, [])

    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      onFocus?.(e)
    }, [onFocus])

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      const parsed = parseDisplay(text)
      onChange(parsed)
      if (!parsed && text !== '') setText('')
      onBlur?.(e)
    }, [text, onChange, onBlur])

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={10}
        className={cn(
          'flex h-8 w-full rounded-sm border bg-white px-2.5 text-[13px] text-zinc-900 transition-colors tabular-nums',
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
    )
  },
)
DateInput.displayName = 'DateInput'

export { DateInput }
