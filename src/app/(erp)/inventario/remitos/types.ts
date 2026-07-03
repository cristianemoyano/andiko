export type DeliveryNoteStatus = 'draft' | 'issued' | 'delivered' | 'annulled'

export const DELIVERY_NOTE_STATUS_LABEL: Record<DeliveryNoteStatus, string> = {
  draft:     'Borrador',
  issued:    'Emitido',
  delivered: 'Entregado',
  annulled:  'Anulado',
}

export interface DeliveryNoteItem {
  id: string
  order_item_id: string | null
  product_id: string | null
  variant_id: string | null
  description: string
  quantity: string
  sort_order: number
}

export interface DeliveryNote {
  id: string
  branch_id: string | null
  order_id: string | null
  contact_id: string | null
  warehouse_id: string | null
  delivery_number: string
  status: DeliveryNoteStatus
  deducts_stock: boolean
  delivery_date: string | null
  carrier_account_id: string | null
  carrier: string | null
  tracking_code: string | null
  ship_to_address: string | null
  notes: string | null
  created_at: string
  branch?: { id: string; name: string; branch_code: number } | null
  contact?: { id: string; legal_name: string; trade_name: string | null } | null
  warehouse?: { id: string; name: string } | null
  carrierAccount?: { id: string; name: string; kind: string } | null
  issuer?: { id: string; name: string } | null
  items?: DeliveryNoteItem[]
  order?: { id: string; order_number: string; status: string } | null
}
