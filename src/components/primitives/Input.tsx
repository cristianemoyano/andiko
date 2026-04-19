import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border bg-white px-3 py-1 text-sm text-gray-900 shadow-sm transition-colors',
      'placeholder:text-gray-400',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-gray-50',
      error
        ? 'border-red-500 focus-visible:ring-red-500'
        : 'border-gray-300 focus-visible:ring-blue-500',
      className
    )}
    aria-invalid={error ? 'true' : undefined}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
