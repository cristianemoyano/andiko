'use client'
import { forwardRef } from 'react'
import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = RadixTabs.Root

const TabsList = forwardRef<
  React.ComponentRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn('flex items-center gap-1 border-b border-zinc-200', className)}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = forwardRef<
  React.ComponentRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      '-mb-px border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-zinc-500 transition-colors cursor-pointer',
      'hover:text-zinc-900',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200',
      'data-[state=active]:border-brand-600 data-[state=active]:text-zinc-900',
      'data-[disabled]:pointer-events-none data-[disabled]:text-zinc-300',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = forwardRef<
  React.ComponentRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn('pt-4 focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
