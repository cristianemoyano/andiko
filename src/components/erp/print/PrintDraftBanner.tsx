import { cn } from '@/lib/utils'

export interface PrintDraftBannerProps {
  className?: string
}

export function PrintDraftBanner({ className }: PrintDraftBannerProps) {
  return (
    <div
      className={cn(
        'rounded-md border-2 border-dashed border-zinc-900 bg-zinc-200 px-4 py-3 text-center print:border-black print:bg-zinc-300',
        className,
      )}
    >
      <p className="text-sm font-bold uppercase tracking-wide text-zinc-900 print:text-black">Borrador</p>
      <p className="mt-1 text-xs text-zinc-700 print:text-zinc-900">
        Uso interno — no válido como comprobante
      </p>
    </div>
  )
}
