'use client'

import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/primitives/Sheet'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import {
  getAccountMovementHref,
  type AccountStatementModule,
} from '@/lib/account-statement-navigation'

export interface AccountMovementSheetLine {
  movement_type: string
  movement_id: string
  related_id?: string | null
  date: string
  document_number: string
  description: string | null
  due_date: string | null
  debit: string
  credit: string
  running_balance: string
}

export interface AccountMovementSheetProps {
  module: AccountStatementModule
  line: AccountMovementSheetLine | null
  movementTypeLabel: Record<string, string>
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="text-[12px] text-fg-muted">{label}</span>
      <span className="text-right text-[13px] text-fg">{children}</span>
    </div>
  )
}

export function AccountMovementSheet({
  module,
  line,
  movementTypeLabel,
  open,
  onOpenChange,
}: AccountMovementSheetProps) {
  const router = useRouter()
  const href = line ? getAccountMovementHref(module, line) : null
  const typeLabel = line ? (movementTypeLabel[line.movement_type] ?? line.movement_type) : ''

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={line?.document_number ?? 'Movimiento'}
      description={typeLabel || undefined}
      contentTestId="account-movement-sheet"
      footer={(
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {href ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                router.push(href)
              }}
            >
              Abrir comprobante
            </Button>
          ) : null}
        </div>
      )}
    >
      {line ? (
        <div className="space-y-4">
          <DetailRow label="Fecha">
            {new Date(line.date).toLocaleDateString('es-AR')}
          </DetailRow>
          <DetailRow label="Tipo">{typeLabel}</DetailRow>
          {line.description ? (
            <DetailRow label="Detalle">
              <span className="max-w-[14rem] text-right">{line.description}</span>
            </DetailRow>
          ) : null}
          {line.due_date ? (
            <DetailRow label="Vencimiento">
              {new Date(line.due_date).toLocaleDateString('es-AR')}
            </DetailRow>
          ) : null}
          <DetailRow label="Debe">
            {Number(line.debit) > 0 ? formatARS(line.debit) : '—'}
          </DetailRow>
          <DetailRow label="Haber">
            {Number(line.credit) > 0 ? formatARS(line.credit) : '—'}
          </DetailRow>
          <DetailRow label="Saldo acumulado">
            <span className={`tabular-nums font-medium ${Number(line.running_balance) > 0 ? 'text-danger' : 'text-success'}`}>
              {formatARS(line.running_balance)}
            </span>
          </DetailRow>
        </div>
      ) : null}
    </Sheet>
  )
}
