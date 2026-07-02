import type { FulfillmentKind, ShipmentStatus } from '../logistics.constants'

export interface ProviderCapabilities {
  /** Puede cotizar el costo de envío antes del despacho. */
  rates: boolean
  /** Puede generar una etiqueta de envío (PDF). */
  label: boolean
  /** Expone eventos de seguimiento consultables. */
  tracking: boolean
  /** Actualiza el seguimiento automáticamente (webhook/poll) en vez de carga manual. */
  autoTracking: boolean
  cancel: boolean
}

export interface ShipmentAddress {
  name: string | null
  phone: string | null
  street: string | null
  number: string | null
  floor: string | null
  apartment: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country: string
}

export interface DispatchItem {
  description: string
  quantity: string
}

export interface DispatchRequest {
  shipmentNumber: string
  /** Cargado por el operador para couriers sin integración de API. */
  trackingNumber: string | null
  destination: ShipmentAddress
  items: DispatchItem[]
  notes: string | null
}

export interface DispatchResult {
  trackingNumber: string | null
  trackingUrl: string | null
  labelUrl: string | null
  /** Decimal como string, en ARS. `null` cuando el provider no cotiza. */
  cost: string | null
}

export interface RateQuote {
  cost: string
  currency: string
  serviceLevel?: string
  etaDays?: number
}

export interface TrackingUpdate {
  status: ShipmentStatus
  description?: string
  occurredAt: Date
  raw?: unknown
}

export class ProviderNotSupportedError extends Error {
  readonly kind: FulfillmentKind
  readonly operation: string
  constructor(kind: FulfillmentKind, operation: string) {
    super('PROVIDER_OPERATION_NOT_SUPPORTED')
    this.name = 'ProviderNotSupportedError'
    this.kind = kind
    this.operation = operation
  }
}

export interface FulfillmentProvider {
  readonly kind: FulfillmentKind
  readonly capabilities: ProviderCapabilities

  /** Cotiza el envío. Lanza ProviderNotSupportedError si `!capabilities.rates`. */
  getRate(req: DispatchRequest): Promise<RateQuote>

  /**
   * Entrega el envío al canal. Para kinds sin API (tracking-only / in-house)
   * no hay llamada externa: solo normaliza los datos cargados por el operador.
   */
  dispatch(req: DispatchRequest): Promise<DispatchResult>

  /** Últimos eventos de seguimiento. Kinds sin API devuelven []. */
  getTracking(trackingNumber: string): Promise<TrackingUpdate[]>

  cancel(trackingNumber: string | null): Promise<void>
}
