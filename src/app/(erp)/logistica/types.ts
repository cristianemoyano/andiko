import type {
  ShipmentStatus,
  FulfillmentKind,
  ShipmentEventSource,
  DeliveryRunStatus,
  DeliveryStopStatus,
} from '@/modules/logistics/logistics.constants'

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
  vehicle_id: string | null
  vehicle_ref: string | null
  shipping_cost: string
  currency: string
  ship_to_name: string | null
  ship_city: string | null
  ship_province: string | null
  ship_postal_code: string | null
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

export type ShipmentDeliveryNoteRow = {
  id: string
  delivery_number: string
  status: 'draft' | 'issued' | 'delivered' | 'annulled'
  delivery_date: string | null
  created_at: string
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
  delivery_result_reason: string | null
  delivery_result_notes: string | null
  salesOrder?: { id: string; order_number: string; status: string; contact_id: string | null } | null
  items?: ShipmentItemRow[]
  events?: ShipmentEventRow[]
  deliveryNotes?: ShipmentDeliveryNoteRow[]
}

export type DeliveryRunListRow = {
  id: string
  branch_id: string
  run_number: string
  status: DeliveryRunStatus
  planned_date: string
  assigned_driver_id: string | null
  vehicle_id: string | null
  vehicle_ref: string | null
  carrier_account_id: string | null
  provider_kind: FulfillmentKind
  dispatched_at: string | null
  completed_at: string | null
  notes: string | null
  shipment_count: number
  created_at: string
  updated_at: string
  driver?: { id: string; name: string } | null
  carrierAccount?: { id: string; name: string; kind: FulfillmentKind } | null
}

export type DeliveryStopRow = {
  id: string
  delivery_run_id: string
  sequence: number
  contact_id: string | null
  ship_to_name: string | null
  ship_to_phone: string | null
  ship_street: string | null
  ship_number: string | null
  ship_floor: string | null
  ship_apartment: string | null
  ship_city: string | null
  ship_province: string | null
  ship_postal_code: string | null
  ship_country: string
  status: DeliveryStopStatus
  delivered_at: string | null
  failure_reason: string | null
  delivery_result_reason: string | null
  delivery_result_notes: string | null
  cod_expected_amount: string | null
  shipments: ShipmentDetailData[]
}

export type DeliveryRunDetailData = DeliveryRunListRow & {
  stops: DeliveryStopRow[]
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

export type VehicleRow = {
  id: string
  branch_id: string | null
  label: string
  plate: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type VehicleOption = { id: string; label: string; plate: string | null }

export type DriverOption = { id: string; name: string }

export function formatShipmentDestination(row: Pick<ShipmentListRow, 'ship_to_name' | 'ship_city' | 'ship_province'>): string {
  return [row.ship_to_name, row.ship_city, row.ship_province].filter(Boolean).join(' · ') || '—'
}

export function formatStopDestination(row: Pick<DeliveryStopRow, 'ship_to_name' | 'ship_city' | 'ship_province' | 'ship_postal_code'>): string {
  return [row.ship_to_name, row.ship_city, row.ship_province, row.ship_postal_code].filter(Boolean).join(' · ') || '—'
}
