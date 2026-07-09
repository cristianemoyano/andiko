import Link from 'next/link'
import { cn } from '@/lib/utils'
import { HelpBubble } from './HelpBubble'

export type AccountingAutoPostScreen = 'sales-invoice' | 'purchase-invoice' | 'journal-entries'

const HINTS: Record<AccountingAutoPostScreen, { label: string; title: string; body: string }> = {
  'sales-invoice': {
    label: 'Contabilidad',
    title: 'Asientos automáticos',
    body: 'Al emitir esta factura y al registrar un cobro, el sistema genera automáticamente el asiento contable correspondiente (venta, IVA débito fiscal y cuenta por cobrar).',
  },
  'purchase-invoice': {
    label: 'Contabilidad',
    title: 'Asientos automáticos',
    body: 'Al recibir esta factura y al registrar un pago, el sistema genera automáticamente el asiento contable correspondiente (mercaderías, IVA crédito fiscal y cuenta por pagar).',
  },
  'journal-entries': {
    label: 'Ayuda',
    title: 'Asientos automáticos vs. manuales',
    body: 'Además de los asientos que creás manualmente, el sistema genera uno automáticamente al emitir una factura de venta, registrar un cobro, recibir una factura de compra o registrar un pago a un proveedor.',
  },
}

export interface AccountingAutoPostHintProps {
  /** Pantalla donde se muestra — define título y texto contextual. */
  screen: AccountingAutoPostScreen
  className?: string
  /** Link a Contabilidad → Asientos (no aplica a la pantalla journal-entries). */
  showJournalEntriesLink?: boolean
  /** Etiqueta junto al ícono; por defecto la de la pantalla. Pasá `null` para solo el ícono. */
  label?: string | null
  /** Línea separadora bajo el título. */
  showDivider?: boolean
}

export function AccountingAutoPostHint({
  screen,
  className,
  showJournalEntriesLink = false,
  label: labelOverride,
  showDivider = false,
}: AccountingAutoPostHintProps) {
  const { label, title, body } = HINTS[screen]
  const visibleLabel = labelOverride === null ? undefined : (labelOverride ?? label)

  const bubble = (
    <HelpBubble title={title} label={visibleLabel}>
      <p>{body}</p>
      {showJournalEntriesLink && (
        <p>
          <Link href="/contabilidad/asientos" className="text-brand-accent hover:underline font-medium">
            Ver asientos →
          </Link>
        </p>
      )}
    </HelpBubble>
  )

  if (!showDivider) {
    return <div className={className}>{bubble}</div>
  }

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {bubble}
      <hr className="m-0 border-0 border-t border-border" aria-hidden="true" />
    </header>
  )
}
