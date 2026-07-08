import type { PrintableRouteControl } from '@/types/printing'

export interface PrintRouteControlProps {
  control: PrintableRouteControl
}

export function PrintRouteControl({ control }: PrintRouteControlProps) {
  return (
    <section className="space-y-5">
      <div className="rounded-md border border-border p-4 print:border-border-strong">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Paradas del reparto</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Control operativo para el chofer. Cada bloque agrupa los envíos del mismo cliente/destino y su remito asociado.
        </p>
      </div>

      {control.stops.map(stop => (
        <article key={stop.sequence} className="break-inside-avoid rounded-md border border-border p-4 print:border-border-strong">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3 print:border-border-strong">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                Parada {stop.sequence} · {stop.status_label}
              </p>
              <h3 className="mt-1 text-base font-semibold text-fg">{stop.customer_name ?? 'Sin destinatario'}</h3>
              <p className="mt-1 text-sm text-fg-muted">{stop.address ?? 'Sin dirección registrada'}</p>
              {stop.phone ? <p className="text-sm text-fg-muted">Tel: {stop.phone}</p> : null}
            </div>
            <div className="text-right text-sm">
              <p className="text-fg-muted">Entregado</p>
              <p className="font-medium">{stop.delivered_at ?? '—'}</p>
            </div>
          </div>

          {(stop.result_reason || stop.result_notes) ? (
            <div className="mt-3 rounded-sm border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
              {stop.result_reason ? <p className="font-medium">{stop.result_reason}</p> : null}
              {stop.result_notes ? <p className="mt-1 whitespace-pre-wrap">{stop.result_notes}</p> : null}
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {stop.shipments.map(shipment => (
              <div key={shipment.shipment_number} className="rounded-sm border border-border p-3 print:border-border-strong">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold">{shipment.shipment_number}</p>
                    <p className="text-sm text-fg-muted">
                      Pedido {shipment.order_number ?? '—'} · Remito {shipment.delivery_note_number ?? 'pendiente'}
                    </p>
                    <p className="text-sm text-fg-muted">Estado envío: {shipment.status_label}</p>
                  </div>
                  <div className="text-right text-sm text-fg-muted">
                    <p>Seguimiento</p>
                    <p className="font-mono text-fg">{shipment.tracking_number ?? '—'}</p>
                  </div>
                </div>

                {shipment.delivery_notes ? (
                  <p className="mt-2 text-sm text-fg-muted whitespace-pre-wrap">Indicaciones: {shipment.delivery_notes}</p>
                ) : null}
                {(shipment.result_reason || shipment.result_notes) ? (
                  <p className="mt-2 text-sm text-warning">
                    {shipment.result_reason ?? 'Resultado'}{shipment.result_notes ? `: ${shipment.result_notes}` : ''}
                  </p>
                ) : null}

                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-fg-muted print:border-border-strong">
                      <th className="py-1.5 text-left font-medium">Ítem / bulto</th>
                      <th className="py-1.5 text-right font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.lines.map((line, idx) => (
                      <tr key={`${shipment.shipment_number}-${idx}`} className="border-b border-border last:border-0 print:border-border-strong">
                        <td className="py-1.5 pr-3">{line.description}</td>
                        <td className="py-1.5 text-right tabular-nums">{line.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="border-t border-border pt-2 print:border-border-strong">
              <p className="text-fg-muted">Firma / aclaración cliente</p>
            </div>
            <div className="border-t border-border pt-2 print:border-border-strong">
              <p className="text-fg-muted">Observaciones del chofer</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  )
}
