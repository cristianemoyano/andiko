import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-8 w-full rounded-sm border bg-surface px-2.5 text-[13px] text-fg transition-colors',
      'placeholder:text-fg-subtle',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-fg-subtle',
      'read-only:bg-surface-muted',
      error
        ? 'border-danger focus-visible:ring-red-200'
        : 'border-border-strong focus-visible:ring-ring focus-visible:border-ring',
      className
    )}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
