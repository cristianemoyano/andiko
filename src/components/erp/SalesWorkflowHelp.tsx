'use client'

import { HelpBubble } from './HelpBubble'
import { cn } from '@/lib/utils'

export interface SalesWorkflowHelpProps {
  className?: string
  /** Etiqueta junto al ícono; `null` = solo ícono. */
  label?: string | null
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

/**
 * Ayuda contextual del flujo de ventas: pedido, factura, cobro, envío y entrega
 * como pasos independientes (sin pipeline fijo).
 */
export function SalesWorkflowHelp({
  className,
  label = null,
  side = 'bottom',
  align = 'end',
}: SalesWorkflowHelpProps) {
  const visibleLabel = label === null ? undefined : (label ?? 'Flujo de ventas')

  return (
    <div className={cn('inline-flex', className)}>
      <HelpBubble
        title="Cómo funciona el flujo de ventas"
        label={visibleLabel}
        side={side}
        align={align}
      >
        <p>
          <strong className="font-medium text-fg">Pedido · factura · cobro · envío · entrega</strong>
          {' '}son pasos independientes. El sistema no impone un pipeline fijo: cada operación define
          el orden según su negocio.
        </p>
        <ul className="list-disc pl-4 space-y-1.5">
          <li>
            <strong className="font-medium text-fg">Mostrador (POS):</strong>
            {' '}cobra, emite comprobante y marca entregado en la misma sucursal. No requiere envío.
          </li>
          <li>
            <strong className="font-medium text-fg">Retiro en sucursal:</strong>
            {' '}al marcar entregado elegís entrega sin envío; la mercadería no pasa por logística.
          </li>
          <li>
            <strong className="font-medium text-fg">Despacho con courier o reparto:</strong>
            {' '}generás el envío cuando despachás. Podés facturar antes, al despachar o después.
          </li>
          <li>
            <strong className="font-medium text-fg">Cuenta corriente:</strong>
            {' '}podés facturar y registrar el cobro más adelante; el pedido no exige pago previo.
          </li>
          <li>
            <strong className="font-medium text-fg">Contra entrega:</strong>
            {' '}facturás o cobrás al entregar; ningún paso bloquea a los demás de forma automática.
          </li>
        </ul>
        <p className="text-[11px] text-fg-subtle pt-0.5">
          Los estados del pedido son guías en pantalla, no reglas rígidas. Usá las acciones del pedido
          (facturar, generar envío, marcar entregado) según lo que necesite cada venta.
        </p>
      </HelpBubble>
    </div>
  )
}
