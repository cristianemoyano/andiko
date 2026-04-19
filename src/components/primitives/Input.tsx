import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-8 w-full rounded-sm border bg-white px-2.5 text-[13px] text-zinc-900 transition-colors',
      'placeholder:text-zinc-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
      'disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400',
      'read-only:bg-zinc-50',
      error
        ? 'border-red-500 focus-visible:ring-red-200'
        : 'border-zinc-300 focus-visible:ring-blue-200 focus-visible:border-blue-500',
      className
    )}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
