import type { FulfillmentKind } from '../logistics.constants'
import type { FulfillmentProvider, ProviderCapabilities, DispatchRequest, DispatchResult, RateQuote, TrackingUpdate } from './fulfillment-provider'
import { ProviderNotSupportedError } from './fulfillment-provider'

/**
 * Links de seguimiento para el cliente final. Se resuelven acá y quedan
 * snapshoteados en `shipments.tracking_url`; si un courier cambia su página,
 * solo afecta envíos nuevos.
 */
const TRACKING_URL_TEMPLATES: Partial<Record<FulfillmentKind, string>> = {
  andreani:         'https://www.andreani.com/#!/informacion-envio/{tracking}',
  correo_argentino: 'https://www.correoargentino.com.ar/formularios/e-commerce?id={tracking}',
  oca:              'https://www.oca.com.ar/Busquedas/Envios?numero={tracking}',
}

export function trackingUrlFor(kind: FulfillmentKind, trackingNumber: string): string | null {
  const template = TRACKING_URL_TEMPLATES[kind]
  if (!template) return null
  return template.replace('{tracking}', encodeURIComponent(trackingNumber))
}

/**
 * Courier sin integración de API (hoy: Andreani, OCA, Correo Argentino y
 * `manual`). El operador despacha en el sistema del courier y pega acá el
 * número de seguimiento; los eventos se cargan a mano.
 */
export class TrackingOnlyProvider implements FulfillmentProvider {
  readonly capabilities: ProviderCapabilities = {
    rates: false,
    label: false,
    tracking: false,
    autoTracking: false,
    cancel: true,
  }

  constructor(readonly kind: FulfillmentKind) {}

  async getRate(): Promise<RateQuote> {
    throw new ProviderNotSupportedError(this.kind, 'getRate')
  }

  async dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const trackingNumber = req.trackingNumber
    return {
      trackingNumber,
      trackingUrl: trackingNumber ? trackingUrlFor(this.kind, trackingNumber) : null,
      labelUrl: null,
      cost: null,
    }
  }

  async getTracking(): Promise<TrackingUpdate[]> {
    return []
  }

  async cancel(): Promise<void> {}
}
