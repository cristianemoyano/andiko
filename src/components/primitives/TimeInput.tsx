import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** "HH:mm" */
  value: string
  onChange: (value: string) => void
  error?: boolean
}

const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(
  ({ value, onChange, error, className, ...props }, ref) => (
    <input
      ref={ref}
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-9 md:h-8 w-full rounded-sm border bg-surface px-2.5 text-base md:text-[13px] text-fg transition-colors tabular-nums',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-fg-subtle',
        error
          ? 'border-danger focus-visible:ring-red-200'
          : 'border-border-strong focus-visible:ring-ring focus-visible:border-ring',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  ),
)
TimeInput.displayName = 'TimeInput'

export { TimeInput }
