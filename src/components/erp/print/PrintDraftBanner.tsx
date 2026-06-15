import { cn } from '@/lib/utils'

export interface PrintDraftBannerProps {
  className?: string
}

export function PrintDraftBanner({ className }: PrintDraftBannerProps) {
  return (
    <div
      className={cn(
        'rounded-md border-2 border-dashed border-fg bg-surface-hover px-4 py-3 text-center print:border-black print:bg-border-strong',
        className,
      )}
    >
      <p className="text-sm font-bold uppercase tracking-wide text-fg print:text-black">Borrador</p>
      <p className="mt-1 text-xs text-fg-muted print:text-fg">
        Uso interno — no válido como comprobante
      </p>
    </div>
  )
}
