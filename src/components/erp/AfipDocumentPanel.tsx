'use client'
import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/layout/Card'
import { Button } from '@/components/primitives/Button'
import { ConfirmDialog } from './ConfirmDialog'
import { AfipStatusBadge, type AfipDocStatus } from './AfipStatusBadge'

/** AFIP comprobante type codes (CbteTipo) → human label. FE-local; no backend import. */
export const COMPROBANTE_TIPO_LABEL: Record<number, string> = {
  1: 'Factura A',
  6: 'Factura B',
  11: 'Factura C',
  2: 'Nota de Débito A',
  7: 'Nota de Débito B',
  12: 'Nota de Débito C',
  3: 'Nota de Crédito A',
  8: 'Nota de Crédito B',
  13: 'Nota de Crédito C',
}

export interface AfipObservationView {
  code: number
  msg: string
}

export interface AfipDocumentData {
  afip_status: AfipDocStatus
  cae: string | null
  cae_expiration: string | null
  comprobante_tipo: number | null
  punto_venta: number | null
  cbte_numero: number | null
  afip_observations: AfipObservationView[] | null
}

export interface AfipDocumentPanelProps {
  doc: AfipDocumentData
  /** When true, shows the "Autorizar AFIP" action. */
  canAuthorize: boolean
  /** Performs the authorize request (owned by the page; panel stays presentational). */
  onAuthorize: () => Promise<void>
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : value
}

function formatComprobanteNumber(pv: number | null, nro: number | null): string | null {
  if (!pv || !nro) return null
  return `${String(pv).padStart(4, '0')}-${String(nro).padStart(8, '0')}`
}

/**
 * Presentational AFIP panel for a fiscal document: shows transmission status,
 * CAE / vencimiento / comprobante details and observations, and an authorize
 * action when allowed. All network calls are delegated to `onAuthorize`.
 */
export function AfipDocumentPanel({ doc, canAuthorize, onAuthorize }: AfipDocumentPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const comprobanteNumber = formatComprobanteNumber(doc.punto_venta, doc.cbte_numero)

  return (
    <Card>
      <CardHeader title="AFIP" actions={<AfipStatusBadge status={doc.afip_status} />} />
      <CardContent className="space-y-3">
        {doc.cae ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <div>
              <dt className="text-fg-muted">CAE</dt>
              <dd className="font-mono text-fg">{doc.cae}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Vencimiento CAE</dt>
              <dd className="text-fg">{formatDate(doc.cae_expiration)}</dd>
            </div>
            {doc.comprobante_tipo != null && (
              <div>
                <dt className="text-fg-muted">Comprobante</dt>
                <dd className="text-fg">{COMPROBANTE_TIPO_LABEL[doc.comprobante_tipo] ?? `Tipo ${doc.comprobante_tipo}`}</dd>
              </div>
            )}
            {comprobanteNumber && (
              <div>
                <dt className="text-fg-muted">Número</dt>
                <dd className="font-mono text-fg">{comprobanteNumber}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-[13px] text-fg-muted">
            Este comprobante todavía no fue autorizado por AFIP.
          </p>
        )}

        {doc.afip_observations && doc.afip_observations.length > 0 && (
          <div className="rounded-sm border border-warning bg-warning-bg px-3 py-2 text-[12px] text-warning">
            <p className="mb-1 font-medium">Observaciones de AFIP</p>
            <ul className="space-y-0.5">
              {doc.afip_observations.map((obs) => (
                <li key={obs.code}>
                  <span className="font-mono">{obs.code}</span>: {obs.msg}
                </li>
              ))}
            </ul>
          </div>
        )}

        {canAuthorize && (
          <div>
            <Button size="sm" onClick={() => setConfirmOpen(true)}>
              Autorizar AFIP
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Autorizar en AFIP"
              description="Se solicitará el CAE a AFIP para este comprobante. Esta acción no se puede deshacer."
              variant="warning"
              confirmLabel="Autorizar"
              onConfirm={onAuthorize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
