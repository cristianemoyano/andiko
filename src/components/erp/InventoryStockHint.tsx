import Link from 'next/link'
import { cn } from '@/lib/utils'
import { HelpBubble } from './HelpBubble'

export type InventoryHintScreen =
  | 'catalog'
  | 'depositos'
  | 'deposito-detalle'
  | 'stock'
  | 'transferencias'
  | 'movimientos'
  | 'remitos'
  | 'reposicion'

const HINTS: Record<InventoryHintScreen, { label: string; title: string; body: string }> = {
  catalog: {
    label: 'Stock',
    title: 'Stock en el catálogo',
    body: 'El número que ves acá es el total sumado de todos los depósitos. Se actualiza con movimientos de inventario. Si importás un CSV con columna de stock y tenés depósitos, elegís en cuál cargar las cantidades (solo productos sin stock en ese depósito).',
  },
  depositos: {
    label: 'Depósitos',
    title: 'Depósitos y carga inicial',
    body: 'Creá un depósito por sucursal o ubicación. Para cargar stock masivo: abrí el depósito → Cargar desde catálogo (productos que ya existen en el sistema). También podés usar Cargar stock producto por producto.',
  },
  stock: {
    label: 'Stock',
    title: 'Stock por depósito',
    body: 'Vista de saldos reales (variante × depósito). Filtrá por depósito, seleccioná productos y configurá el mínimo en masa, o definí un mínimo predeterminado en el depósito. El vencimiento se configura por producto.',
  },
  transferencias: {
    label: 'Transferencias',
    title: 'Transferencias entre depósitos',
    body: 'Elegí origen y destino, marcá productos y definí la cantidad a transferir (por defecto el stock completo). Queda registrado en Movimientos.',
  },
  movimientos: {
    label: 'Movimientos',
    title: 'Historial de movimientos',
    body: 'Auditoría de entradas, salidas, ajustes y transferencias. Filtrá por depósito o producto. Para ver solo un depósito, también podés abrir su detalle.',
  },
  remitos: {
    label: 'Remitos',
    title: 'Remitos de entrega',
    body: 'Comprobante de salida de mercadería sin factura. Creá un remito, asigná cliente y depósito, y registrá los productos entregados.',
  },
  reposicion: {
    label: 'Reposición',
    title: 'Reposición',
    body: 'Lista productos cuyo stock está en o por debajo del mínimo configurado en cada depósito (en Stock y alertas). Desde acá podés exportar o armar una orden de compra.',
  },
  'deposito-detalle': {
    label: 'Ayuda',
    title: 'Carga inicial en este depósito',
    body: 'Cargar desde catálogo lista productos del catálogo para darlos de alta acá. La carga masiva solo asigna cantidad a los que aún no tienen stock en este depósito; no pisa lo ya cargado. Cargar stock ajusta un producto puntual que ya está en el depósito.',
  },
}

export interface InventoryStockHintProps {
  /** Pantalla de inventario/catálogo — define título y texto contextual. */
  screen: InventoryHintScreen
  className?: string
  /** Link a stock global (solo catálogo). */
  showStockLink?: boolean
  /** Etiqueta junto al ícono; por defecto la de la pantalla. Pasá `null` para solo el ícono. */
  label?: string | null
  /** Línea separadora bajo el título (patrón estándar de sección de inventario). */
  showDivider?: boolean
}

export function InventoryStockHint({
  screen,
  className,
  showStockLink = false,
  label: labelOverride,
  showDivider = true,
}: InventoryStockHintProps) {
  const { label, title, body } = HINTS[screen]
  const visibleLabel = labelOverride === null ? undefined : (labelOverride ?? label)

  const bubble = (
    <HelpBubble title={title} label={visibleLabel}>
      <p>{body}</p>
      {showStockLink && (
        <p>
          <Link href="/inventario/stock" className="text-brand-accent hover:underline font-medium">
            Ver stock por depósito →
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

/** @deprecated Usar InventoryStockHint con prop screen */
export const INVENTORY_STOCK_HINT_TITLE = HINTS.stock.title
export const INVENTORY_STOCK_HINT_BODY = HINTS.stock.body
export const INVENTORY_STOCK_HINT_COMPACT = HINTS.stock.body
