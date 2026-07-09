import { cn } from '@/lib/utils'

export const PRICE_LIST_DEFAULT_HINT_TITLE = 'Lista predeterminada'

export const PRICE_LIST_DEFAULT_HINT_BODY =
  'Es la lista de referencia de tu organización (solo puede haber una). El POS sincroniza precios desde aquí, el import CSV guarda precios en esta lista, y en Ajustes de precios aparece preseleccionada. En presupuestos y pedidos elegís la lista en cada documento; no se aplica sola. Para canales como Mayorista o Minorista, cloná esta lista y ajustá la copia.'

export const PRICE_LIST_DEFAULT_HINT_COMPACT =
  'Referencia para POS e importaciones. Solo una por organización; en ventas elegís la lista en cada documento.'

export interface PriceListDefaultHintProps {
  className?: string
  /** Texto más corto para modales y formularios. */
  compact?: boolean
}

export function PriceListDefaultHint({ className, compact = false }: PriceListDefaultHintProps) {
  return (
    <div
      className={cn(
        'rounded-sm border border-brand-accent-border bg-brand-accent-bg px-3 py-2.5 text-[12px] text-fg-muted leading-relaxed',
        className,
      )}
      role="note"
    >
      <p className="font-medium text-fg text-[13px] mb-1">{PRICE_LIST_DEFAULT_HINT_TITLE}</p>
      <p>{compact ? PRICE_LIST_DEFAULT_HINT_COMPACT : PRICE_LIST_DEFAULT_HINT_BODY}</p>
    </div>
  )
}
