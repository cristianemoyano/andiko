import type { ReactNode } from 'react'
import type { PosSalePayment } from '@andiko/shared'
import type { PosFiscalProfile } from '../lib/usePosFiscalProfile'
import {
  AFIP_CF_ID_THRESHOLD_ARS,
  DEFAULT_CONSUMER_DEFENSE_LINE,
  formatActivityStart,
  formatCashierLastName,
  formatCuit,
  formatTicketDate,
  formatTicketMoney,
  formatTicketQty,
  formatTicketTime,
  formatTicketUnitPrice,
  ivaConditionTicketLabel,
  parseTicketNumber,
  paymentTypeTicketLabel,
} from '../lib/pos-fiscal-labels'
import { AfipQrCode } from './AfipQrCode'

export type PosReceiptItem = {
  product_name: string
  qty: number
  unit_price: string
  iva_rate: string
  total: string
}

export type PosReceiptCustomer = {
  legal_name: string
  trade_name: string | null
  cuit: string | null
  iva_condition: string | null
} | null

export type PosReceiptProps = {
  ticketNumber: string
  soldAt: string
  items: PosReceiptItem[]
  subtotal: string
  taxAmount: string
  total: string
  payments: PosSalePayment[]
  customer: PosReceiptCustomer
  fiscal: PosFiscalProfile
  /** Nombre del cajero (se imprime como CAJ: APELLIDO) */
  cashierName?: string | null
  /** CAE / QR from cloud authorize */
  cae?: string | null
  caeExpiration?: string | null
  qrUrl?: string | null
  /** When true, renders non-fiscal internal receipt (no CAE yet). */
  fiscalPending?: boolean
  /** Vuelto en efectivo, si aplica */
  changeAmount?: string | null
}

function TicketRow({ left, right }: { left: string; right?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0 break-words">{left}</span>
      {right != null && <span className="shrink-0 tabular-nums text-right">{right}</span>}
    </div>
  )
}

function TicketText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`leading-snug ${className}`}>{children}</div>
}

/**
 * Thermal fiscal ticket layout (80 mm) — mirrors common Argentine POS printers.
 * CAE + QR se agregan cuando esté la autorización AFIP.
 */
export function PosReceipt({
  ticketNumber,
  soldAt,
  items,
  taxAmount,
  total,
  payments,
  customer,
  fiscal,
  cashierName,
  changeAmount,
  cae,
  caeExpiration,
  qrUrl,
  fiscalPending,
}: PosReceiptProps) {
  const soldDate = new Date(soldAt)
  const totalNum = parseFloat(total)
  const isConsumidorFinal = !customer
  const isFiscalAuthorized = Boolean(cae) && !fiscalPending
  const { pv, number } = parseTicketNumber(ticketNumber, fiscal.puntoVenta)
  const codigo = fiscal.comprobanteCodigo ?? '083'
  const paymentsSum = payments.reduce((s, p) => s + parseFloat(p.amount), 0)
  const cashPayment = payments.find((p) => p.payment_method_type === 'cash')
  const cashTendered = cashPayment?.tendered_amount ?? null
  const resolvedChange = (() => {
    if (changeAmount != null && changeAmount !== '') return changeAmount
    if (cashPayment && cashTendered) {
      const diff = parseFloat(cashTendered) - parseFloat(cashPayment.amount)
      if (!Number.isNaN(diff) && diff >= 0) return diff.toFixed(2)
    }
    return null
  })()
  const ivaTicketLabel = ivaConditionTicketLabel(fiscal.ivaCondition)
  const activityStart = formatActivityStart(fiscal.activityStartDate)
  const tradeName = fiscal.orgName
  const legalName = fiscal.legalName
  const showLegalName = legalName && legalName !== tradeName
  const cashierLastName = formatCashierLastName(cashierName)

  return (
    <div
      id="pos-receipt"
      className="pos-receipt mx-auto w-full max-w-[80mm] bg-white p-2 font-mono text-[10px] leading-snug text-black sm:text-[11px]"
    >
      {/* ── Encabezado emisor ── */}
      {tradeName && (
        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-tight">{tradeName}</div>
      )}
      {showLegalName && <TicketText className="uppercase">{legalName}</TicketText>}
      {fiscal.cuit && (
        <TicketText>C.U.I.T. Nro.: {formatCuit(fiscal.cuit)}</TicketText>
      )}
      {fiscal.grossIncome && (
        <TicketText>Ing. Brutos: {fiscal.grossIncome}</TicketText>
      )}
      {fiscal.establishmentCode && (
        <TicketText>Establecimiento: {fiscal.establishmentCode}</TicketText>
      )}
      {fiscal.fiscalAddress && (
        <TicketText>Domicilio: {fiscal.fiscalAddress.toUpperCase()}</TicketText>
      )}
      {fiscal.branchAddress && fiscal.branchAddress !== fiscal.fiscalAddress && (
        <TicketText>{fiscal.branchAddress.toUpperCase()}</TicketText>
      )}
      {fiscal.branchName && !fiscal.branchAddress && (
        <TicketText>{fiscal.branchName.toUpperCase()}</TicketText>
      )}
      {activityStart && (
        <TicketText>Inicio de Actividades: {activityStart}</TicketText>
      )}
      {ivaTicketLabel && <TicketText className="uppercase">{ivaTicketLabel}</TicketText>}
      {isConsumidorFinal ? (
        <TicketText className="font-bold uppercase">A CONSUMIDOR FINAL</TicketText>
      ) : (
        <>
          <TicketText className="font-bold uppercase">
            {customer.trade_name ?? customer.legal_name}
          </TicketText>
          {customer.cuit && (
            <TicketText>CUIT: {formatCuit(customer.cuit)}</TicketText>
          )}
        </>
      )}

      <div className="my-2 border-t border-dashed border-black/40" />

      {/* ── Comprobante ── */}
      {isFiscalAuthorized ? (
        <>
          <TicketText className="font-bold uppercase">TIQUE (Cód.{codigo})</TicketText>
          <TicketText>{`P.V. N° ${pv} Nro. T. ${number}`}</TicketText>
        </>
      ) : (
        <>
          <TicketText className="font-bold uppercase text-center">Comprobante no fiscal</TicketText>
          <TicketText className="text-center text-[9px] uppercase leading-tight">
            Pendiente autorización AFIP
          </TicketText>
          <TicketText>{`Ref: ${ticketNumber.slice(0, 8).toUpperCase()}`}</TicketText>
        </>
      )}
      <TicketText>{`Fecha ${formatTicketDate(soldDate)} Hora ${formatTicketTime(soldDate)}`}</TicketText>
      {cashierLastName && (
        <TicketText>{`CAJ: ${cashierLastName}`}</TicketText>
      )}

      <div className="my-2 border-t border-dashed border-black/40" />

      {/* ── Detalle ── */}
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={`${it.product_name}-${idx}`}>
            <TicketText>
              {`${formatTicketQty(it.qty)} u x ${formatTicketUnitPrice(it.unit_price)}`}
            </TicketText>
            <TicketRow
              left={it.product_name.toUpperCase()}
              right={formatTicketMoney(it.total)}
            />
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-black/40" />

      {/* ── Total ── */}
      <div className="flex justify-between gap-2 text-[13px] font-bold uppercase leading-tight sm:text-[14px]">
        <span>TOTAL</span>
        <span className="tabular-nums">{formatTicketMoney(total)}</span>
      </div>

      <div className="my-2" />

      {/* ── Cobro ── */}
      <TicketText className="font-bold uppercase">RECIBI(MOS)</TicketText>
      {payments.map((p, idx) => (
        <div key={`${p.payment_method_id}-${idx}`}>
          <TicketText className="uppercase">
            {paymentTypeTicketLabel(p.payment_method_type, p.payment_method_name)} :
          </TicketText>
          <TicketRow
            left={p.payment_method_name}
            right={formatTicketMoney(
              p.payment_method_type === 'cash' && p.tendered_amount
                ? p.tendered_amount
                : p.amount,
            )}
          />
        </div>
      ))}
      <TicketRow left="Suma de sus pagos" right={formatTicketMoney(paymentsSum)} />
      {cashPayment && resolvedChange != null && (
        <TicketRow left="Su Vuelto" right={formatTicketMoney(resolvedChange)} />
      )}

      <div className="my-2 border-t border-dashed border-black/40" />

      {/* ── Transparencia fiscal (RG 5615) ── */}
      <TicketText className="text-center font-bold uppercase">Transparencia Fiscal</TicketText>
      <TicketText className="text-center">{`IVA contenido: $ ${formatTicketMoney(taxAmount)}`}</TicketText>

      {isConsumidorFinal && totalNum >= AFIP_CF_ID_THRESHOLD_ARS && (
        <TicketText className="mt-1 text-[9px]">
          Operación ≥ ${formatTicketMoney(AFIP_CF_ID_THRESHOLD_ARS)}: identificar comprador (CUIT/CUIL/DNI).
        </TicketText>
      )}

      <TicketText className="mt-2 text-center text-[9px] uppercase leading-tight">
        {fiscal.consumerDefenseLine?.trim() || DEFAULT_CONSUMER_DEFENSE_LINE}
      </TicketText>

      <TicketText className="mt-2 text-center text-[9px] text-black/55">
        {`powered by Andiko POS · v${__APP_VERSION__}`}
      </TicketText>

      {/* ── CAE / QR AFIP ── */}
      <div className="my-3 pt-2 text-center text-[9px]">
        {isFiscalAuthorized ? (
          <>
            {qrUrl && <AfipQrCode key={qrUrl} value={qrUrl} size={120} />}
            <TicketText>{`CAE N°: ${cae}`}</TicketText>
            {caeExpiration && (
              <TicketText>{`Vto CAE: ${formatActivityStart(caeExpiration) ?? caeExpiration}`}</TicketText>
            )}
          </>
        ) : (
          <TicketText className="font-bold uppercase leading-tight text-black/70">
            Sin CAE — autorizá desde Ventas cuando haya conexión
          </TicketText>
        )}
      </div>
    </div>
  )
}
