'use client'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

/**
 * Provider opcional para envolver la app (evita providers anidados por tooltip).
 * `Tooltip` funciona igual sin él: incluye su propio Provider interno.
 */
function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof RadixTooltip.Provider>) {
  return <RadixTooltip.Provider delayDuration={delayDuration} {...props} />
}

export interface TooltipProps {
  /** Contenido del tooltip. Si es vacío, no se renderiza tooltip. */
  content: React.ReactNode
  /** Elemento disparador — recibe las props del trigger (asChild). */
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Demora en ms antes de mostrar. Default 300 (denso ERP). */
  delayDuration?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300,
  open,
  onOpenChange,
  className,
}: TooltipProps) {
  if (content === null || content === undefined || content === '') {
    return <>{children}</>
  }
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root open={open} onOpenChange={onOpenChange}>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            align={align}
            sideOffset={5}
            className={cn(
              'z-50 max-w-xs rounded-sm bg-zinc-900 px-2 py-1 text-[12px] leading-snug text-zinc-50 shadow-md',
              'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
              'duration-150',
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-fg" width={8} height={4} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}

export { Tooltip, TooltipProvider }
