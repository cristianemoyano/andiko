import type { ShipmentStatus, FulfillmentKind, ShipmentEventSource } from '@/modules/logistics/logistics.constants'

export type ShipmentListRow = {
  id: string
  branch_id: string
  sales_order_id: string
  carrier_account_id: string | null
  shipment_number: string
  status: ShipmentStatus
  provider_kind: FulfillmentKind
  tracking_number: string | null
  tracking_url: string | null
  assigned_driver_id: string | null
  vehicle_ref: string | null
  shipping_cost: string
  currency: string
  ship_to_name: string | null
  ship_city: string | null
  ship_province: string | null
  promised_date: string | null
  dispatched_at: string | null
  delivered_at: string | null
  created_at: string
  salesOrder?: { id: string; order_number: string; contact_id: string | null } | null
  carrierAccount?: { id: string; name: string; kind: FulfillmentKind } | null
  driver?: { id: string; name: string } | null
}

export type ShipmentEventRow = {
  id: string
  status: ShipmentStatus
  description: string | null
  occurred_at: string
  source: ShipmentEventSource
}

export type ShipmentItemRow = {
  id: string
  sales_order_item_id: string
  description: string
  quantity: string
}

export type ShipmentDetailData = ShipmentListRow & {
  warehouse_id: string | null
  label_url: string | null
  ship_to_phone: string | null
  ship_street: string | null
  ship_number: string | null
  ship_floor: string | null
  ship_apartment: string | null
  ship_postal_code: string | null
  ship_country: string
  delivery_notes: string | null
  failure_reason: string | null
  salesOrder?: { id: string; order_number: string; status: string; contact_id: string | null } | null
  items?: ShipmentItemRow[]
  events?: ShipmentEventRow[]
}

export type CarrierAccountRow = {
  id: string
  branch_id: string | null
  kind: FulfillmentKind
  name: string
  is_active: boolean
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type DriverOption = { id: string; name: string }

export function formatShipmentDestination(row: Pick<ShipmentListRow, 'ship_to_name' | 'ship_city' | 'ship_province'>): string {
  return [row.ship_to_name, row.ship_city, row.ship_province].filter(Boolean).join(' · ') || '—'
}
