'use client'
import { forwardRef } from 'react'
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const DropdownMenu = RadixDropdown.Root
const DropdownMenuTrigger = RadixDropdown.Trigger

const DropdownMenuContent = forwardRef<
  React.ComponentRef<typeof RadixDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Content>
>(({ className, sideOffset = 4, align = 'end', ...props }, ref) => (
  <RadixDropdown.Portal>
    <RadixDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-sm border border-border bg-surface p-1 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'duration-150',
        className,
      )}
      {...props}
    />
  </RadixDropdown.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

const itemVariants = cva(
  [
    'flex w-full cursor-pointer select-none items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-[13px] outline-none transition-colors',
    'data-[disabled]:pointer-events-none data-[disabled]:text-fg-subtle',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'text-fg-muted data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg',
        destructive: 'text-danger data-[highlighted]:bg-danger-bg data-[highlighted]:text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface DropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof RadixDropdown.Item>,
    VariantProps<typeof itemVariants> {}

const DropdownMenuItem = forwardRef<
  React.ComponentRef<typeof RadixDropdown.Item>,
  DropdownMenuItemProps
>(({ className, variant, ...props }, ref) => (
  <RadixDropdown.Item
    ref={ref}
    className={cn(itemVariants({ variant }), className)}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

const DropdownMenuSeparator = forwardRef<
  React.ComponentRef<typeof RadixDropdown.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Separator>
>(({ className, ...props }, ref) => (
  <RadixDropdown.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-surface-hover', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

const DropdownMenuLabel = forwardRef<
  React.ComponentRef<typeof RadixDropdown.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdown.Label>
>(({ className, ...props }, ref) => (
  <RadixDropdown.Label
    ref={ref}
    className={cn('px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
