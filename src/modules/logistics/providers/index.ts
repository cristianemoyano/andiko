import type { FulfillmentKind } from '../logistics.constants'
import type { FulfillmentProvider } from './fulfillment-provider'
import { InHouseProvider } from './in-house.provider'
import { TrackingOnlyProvider } from './tracking-only.provider'

export type {
  FulfillmentProvider,
  ProviderCapabilities,
  ShipmentAddress,
  DispatchItem,
  DispatchRequest,
  DispatchResult,
  RateQuote,
  TrackingUpdate,
} from './fulfillment-provider'
export { ProviderNotSupportedError } from './fulfillment-provider'
export { InHouseProvider } from './in-house.provider'
export { TrackingOnlyProvider, trackingUrlFor } from './tracking-only.provider'

// OCA y Correo Argentino pasan a providers con API (rates/label/autoTracking)
// cuando llegue la integración; hasta entonces operan como tracking-only.
const registry: Record<FulfillmentKind, () => FulfillmentProvider> = {
  in_house:         () => new InHouseProvider(),
  andreani:         () => new TrackingOnlyProvider('andreani'),
  correo_argentino: () => new TrackingOnlyProvider('correo_argentino'),
  oca:              () => new TrackingOnlyProvider('oca'),
  manual:           () => new TrackingOnlyProvider('manual'),
}

export function getFulfillmentProvider(kind: FulfillmentKind): FulfillmentProvider {
  return registry[kind]()
}
