'use client'
import { forwardRef, useId } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const switchVariants = cva(
  [
    'group inline-flex flex-shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-out cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-600',
    'data-[state=unchecked]:bg-border-strong data-[state=checked]:bg-brand-600',
    'disabled:cursor-not-allowed disabled:data-[state=unchecked]:bg-surface-hover disabled:data-[state=checked]:bg-border-strong',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-4 w-7',
        md: 'h-5 w-9',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

const thumbVariants = cva(
  'pointer-events-none block rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out data-[state=unchecked]:translate-x-0',
  {
    variants: {
      size: {
        sm: 'h-3 w-3 data-[state=checked]:translate-x-3',
        md: 'h-4 w-4 data-[state=checked]:translate-x-4',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

export interface SwitchProps extends VariantProps<typeof switchVariants>, React.AriaAttributes {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: React.ReactNode
  disabled?: boolean
  required?: boolean
  name?: string
  value?: string
  id?: string
  className?: string
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ label, size, id, disabled, className, ...props }, ref) => {
    const autoId = useId()
    const switchId = id ?? autoId

    const control = (
      <RadixSwitch.Root
        ref={ref}
        id={switchId}
        disabled={disabled}
        className={cn(switchVariants({ size }), !label && className)}
        {...props}
      >
        <RadixSwitch.Thumb className={thumbVariants({ size })} />
      </RadixSwitch.Root>
    )

    if (!label) return control

    return (
      <div className={cn('flex items-center gap-2', className)}>
        {control}
        <label
          htmlFor={switchId}
          className={cn(
            'text-[13px] select-none',
            disabled ? 'cursor-not-allowed text-fg-subtle' : 'cursor-pointer text-fg-muted',
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
