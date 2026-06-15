'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-sm border bg-surface px-2.5 py-2 text-[13px] text-fg transition-colors resize-y',
        'placeholder:text-fg-subtle',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-fg-subtle',
        'read-only:bg-surface-muted',
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
Textarea.displayName = 'Textarea'

export { Textarea }
