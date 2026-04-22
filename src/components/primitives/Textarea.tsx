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
        'flex min-h-[80px] w-full rounded-sm border bg-white px-2.5 py-2 text-[13px] text-zinc-900 transition-colors resize-y',
        'placeholder:text-zinc-400',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400',
        'read-only:bg-zinc-50',
        error
          ? 'border-red-500 focus-visible:ring-red-200'
          : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Textarea }
