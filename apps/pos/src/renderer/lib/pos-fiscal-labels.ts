/** Mirrors ERP `ORG_IVA_CONDITION_LABEL` — kept local because POS cannot import server modules. */
export const IVA_CONDITION_LABEL: Record<string, string> = {
  responsable_inscripto: 'Responsable Inscripto',
  monotributista: 'Monotributista',
  consumidor_final: 'Consumidor Final',
  exento: 'Exento',
  no_responsable: 'No Responsable',
}

/** Uppercase ticket legend (fiscal printer style). */
export const IVA_CONDITION_TICKET_LABEL: Record<string, string> = {
  responsable_inscripto: 'IVA RESPONSABLE INSCRIPTO',
  monotributista: 'IVA MONOTRIBUTO',
  consumidor_final: 'IVA CONSUMIDOR FINAL',
  exento: 'IVA EXENTO',
  no_responsable: 'IVA NO RESPONSABLE',
}

export function ivaConditionLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return IVA_CONDITION_LABEL[code] ?? code
}

export function ivaConditionTicketLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return IVA_CONDITION_TICKET_LABEL[code] ?? `IVA ${IVA_CONDITION_LABEL[code]?.toUpperCase() ?? code.toUpperCase()}`
}

/** RG 1415 / AFIP — CUIT display XX-XXXXXXXX-X */
export function formatCuit(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return raw.trim()
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

export function formatMoneyArs(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Thermal ticket: 5800,00 */
export function formatTicketMoney(value: string | number): string {
  return formatMoneyArs(value)
}

/** Thermal ticket qty line: 1,0000 */
export function formatTicketQty(qty: number): string {
  return qty.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

/** Thermal ticket unit price: 5800,0000 */
export function formatTicketUnitPrice(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return n.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

export function formatTicketDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTicketTime(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function formatActivityStart(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return formatTicketDate(d)
}

/** Split `0003-00146680` → PV + ticket seq (fiscal printer layout). */
export function parseTicketNumber(
  ticketNumber: string,
  fallbackPv: string | null,
): { pv: string; number: string } {
  const dash = ticketNumber.indexOf('-')
  if (dash > 0) {
    return {
      pv: ticketNumber.slice(0, dash).padStart(5, '0'),
      number: ticketNumber.slice(dash + 1).padStart(8, '0'),
    }
  }
  return {
    pv: (fallbackPv ?? '1').padStart(5, '0'),
    number: ticketNumber.replace(/\D/g, '').padStart(8, '0').slice(-8),
  }
}

export function paymentTypeTicketLabel(type: string, name: string): string {
  switch (type) {
    case 'cash': return 'PAGO EN EFECTIVO'
    case 'card': return 'PAGO CON TARJETA'
    case 'transfer': return 'PAGO POR TRANSFERENCIA'
    case 'qr': return 'PAGO CON QR'
    case 'current_account': return 'CUENTA CORRIENTE'
    case 'check': return 'PAGO CON CHEQUE'
    default: return name.toUpperCase()
  }
}

/** IVA included in line totals → net base + tax per alícuota (RG 1415 detail). */
export function ivaBreakdown(items: Array<{ total: string; iva_rate: string }>): Array<{
  rate: string
  label: string
  net: number
  tax: number
}> {
  const buckets = new Map<string, { net: number; tax: number }>()
  for (const item of items) {
    const rate = parseFloat(item.iva_rate) / 100
    const gross = parseFloat(item.total)
    const net = gross / (1 + rate)
    const tax = gross - net
    const key = item.iva_rate
    const prev = buckets.get(key) ?? { net: 0, tax: 0 }
    buckets.set(key, { net: prev.net + net, tax: prev.tax + tax })
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([rate, { net, tax }]) => ({
      rate,
      label: `${rate}%`,
      net,
      tax,
    }))
}

/** AFIP: above this ARS total, consumidor final must identify with CUIT/CUIL/DNI. */
export const AFIP_CF_ID_THRESHOLD_ARS = 10_000_000

/** Leyenda nacional por defecto cuando la org no configuró una propia. */
export const DEFAULT_CONSUMER_DEFENSE_LINE =
  'Defensa de las y los Consumidores. Reclamos: www.argentina.gob.ar/defensadelconsumidor'

/** Apellido del cajero para leyenda térmica `CAJ: APELLIDO`. */
export function formatCashierLastName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1]
  return last ? last.toUpperCase() : null
}
