import { cn } from '@/lib/utils'
import {
  resolveSalesDocumentDisplay,
  type FiscalDocumentRefs,
} from '@/lib/fiscal-document-number'

export interface SalesDocumentNumberProps extends FiscalDocumentRefs {
  className?: string
  /** Detail headers show internal ref when the fiscal number is primary. */
  variant?: 'inline' | 'heading'
}

export function SalesDocumentNumber({
  internalNumber,
  afip_status,
  punto_venta,
  cbte_numero,
  className,
  variant = 'inline',
}: SalesDocumentNumberProps) {
  const display = resolveSalesDocumentDisplay({
    internalNumber,
    afip_status,
    punto_venta,
    cbte_numero,
  })

  if (variant === 'heading') {
    return (
      <div className={className}>
        <span className="font-mono">{display.primary}</span>
        {display.isFiscalNumber ? (
          <p className="mt-0.5 text-[11px] font-normal text-fg-subtle">
            Ref. interna {display.internal}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <span className={cn('font-mono text-[12px] text-fg-muted', className)}>
      {display.primary}
    </span>
  )
}
