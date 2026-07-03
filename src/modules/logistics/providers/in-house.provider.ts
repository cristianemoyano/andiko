import type { FulfillmentProvider, ProviderCapabilities, DispatchRequest, DispatchResult, RateQuote, TrackingUpdate } from './fulfillment-provider'
import { ProviderNotSupportedError } from './fulfillment-provider'

/**
 * Reparto propio: sin API externa. El seguimiento avanza por transiciones
 * manuales del chofer/operador, que quedan en `shipment_events`.
 */
export class InHouseProvider implements FulfillmentProvider {
  readonly kind = 'in_house' as const
  readonly capabilities: ProviderCapabilities = {
    rates: false,
    label: false,
    tracking: true,
    autoTracking: false,
    cancel: true,
  }

  async getRate(): Promise<RateQuote> {
    throw new ProviderNotSupportedError(this.kind, 'getRate')
  }

  async dispatch(req: DispatchRequest): Promise<DispatchResult> {
    const trackingNumber = req.trackingNumber ?? req.shipmentNumber
    return { trackingNumber, trackingUrl: null, labelUrl: null, cost: null }
  }

  async getTracking(): Promise<TrackingUpdate[]> {
    return []
  }

  async cancel(): Promise<void> {}
}
