'use client'
import { forwardRef, useId } from 'react'
import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { cn } from '@/lib/utils'

export type CheckboxCheckedState = boolean | 'indeterminate'

export interface CheckboxProps extends React.AriaAttributes {
  checked?: CheckboxCheckedState
  defaultChecked?: CheckboxCheckedState
  onCheckedChange?: (checked: CheckboxCheckedState) => void
  label?: React.ReactNode
  disabled?: boolean
  required?: boolean
  name?: string
  value?: string
  id?: string
  error?: boolean
  className?: string
}

const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ label, id, error, disabled, className, ...props }, ref) => {
    const autoId = useId()
    const checkboxId = id ?? autoId

    const box = (
      <RadixCheckbox.Root
        ref={ref}
        id={checkboxId}
        disabled={disabled}
        className={cn(
          'group flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border bg-surface transition-[color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          'data-[state=checked]:bg-brand-600 data-[state=checked]:border-brand-600',
          'data-[state=indeterminate]:bg-brand-600 data-[state=indeterminate]:border-brand-600',
          'disabled:cursor-not-allowed disabled:bg-surface-hover disabled:border-border',
          'disabled:data-[state=checked]:bg-border-strong disabled:data-[state=checked]:border-border-strong',
          'disabled:data-[state=indeterminate]:bg-border-strong disabled:data-[state=indeterminate]:border-border-strong',
          error
            ? 'border-danger focus-visible:ring-red-200'
            : 'border-border-strong hover:border-border-strong focus-visible:ring-ring',
          !label && className,
        )}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      >
        <RadixCheckbox.Indicator className="text-white">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden group-data-[state=checked]:block"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden group-data-[state=indeterminate]:block"
            aria-hidden
          >
            <path d="M5 12h14" />
          </svg>
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
    )

    if (!label) return box

    return (
      <div className={cn('flex items-start gap-2', className)}>
        <span className="flex h-[19px] items-center">{box}</span>
        <label
          htmlFor={checkboxId}
          className={cn(
            'text-[13px] leading-[19px] select-none',
            disabled ? 'cursor-not-allowed text-fg-subtle' : 'cursor-pointer text-fg-muted',
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
