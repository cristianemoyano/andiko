export type ProductionOrderStatus = 'draft' | 'released' | 'in_process' | 'done' | 'cancelled'

export const PRODUCTION_ORDER_STATUS_LABEL: Record<ProductionOrderStatus, string> = {
  draft:       'Borrador',
  released:    'Liberada',
  in_process:  'En proceso',
  done:        'Terminada',
  cancelled:   'Cancelada',
}

export type Branch = { id: string; name: string; branch_code: number }
export type WarehouseSummary = { id: string; name: string }
export type ProductSummary = { id: string; name: string; production_type?: string | null }
export type VariantSummary = { id: string; sku: string; name: string | null; cost_price?: string | null; product?: ProductSummary | null }

export type BomItem = {
  id: string
  component_variant_id: string
  quantity: string
  scrap_pct: string
  sort_order: number
  notes: string | null
  component?: VariantSummary
}

export type Bom = {
  id: string
  variant_id: string
  name: string
  output_quantity: string
  is_active: boolean
  notes: string | null
  created_at: string
  variant?: VariantSummary
  items: BomItem[]
}

export type ProductionOrderLine = {
  id: string
  component_variant_id: string
  planned_quantity: string
  consumed_quantity: string
  sort_order: number
  component?: VariantSummary
}

export type ProductionOrder = {
  id: string
  order_number: string
  status: ProductionOrderStatus
  branch_id: string
  warehouse_id: string | null
  bom_id: string
  variant_id: string
  planned_quantity: string
  produced_quantity: string
  scheduled_date: string | null
  released_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  notes: string | null
  created_at: string
  branch: Branch | null
  warehouse: WarehouseSummary | null
  variant?: VariantSummary
  bom?: { id: string; name: string; output_quantity: string }
  lines: ProductionOrderLine[]
}
