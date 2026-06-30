import { z } from 'zod'

export const stockTransferSchema = z.object({
  variant_id:         z.string().uuid(),
  from_warehouse_id:  z.string().uuid(),
  to_warehouse_id:    z.string().uuid(),
  quantity:           z.coerce.number().positive(),
  notes:              z.string().max(500).nullable().optional(),
}).refine(d => d.from_warehouse_id !== d.to_warehouse_id, {
  message: 'Los depósitos origen y destino deben ser distintos',
  path: ['to_warehouse_id'],
})

export const stockTransferAllSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id:   z.string().uuid(),
  notes:             z.string().max(500).nullable().optional(),
}).refine(d => d.from_warehouse_id !== d.to_warehouse_id, {
  message: 'Los depósitos origen y destino deben ser distintos',
  path: ['to_warehouse_id'],
})

export const stockTransferBatchItemSchema = z.object({
  variant_id: z.string().uuid(),
  /** Si se omite, el servidor transfiere todo el saldo en origen. */
  quantity:   z.coerce.number().positive().optional(),
})

export const stockTransferBatchSchema = z.object({
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id:   z.string().uuid(),
  notes:             z.string().max(500).nullable().optional(),
  items:             z.array(stockTransferBatchItemSchema).min(1).max(500),
}).refine(d => d.from_warehouse_id !== d.to_warehouse_id, {
  message: 'Los depósitos origen y destino deben ser distintos',
  path: ['to_warehouse_id'],
})

export type StockTransferInput       = z.infer<typeof stockTransferSchema>
export type StockTransferAllInput    = z.infer<typeof stockTransferAllSchema>
export type StockTransferBatchInput  = z.infer<typeof stockTransferBatchSchema>
export type StockTransferBatchItem   = z.infer<typeof stockTransferBatchItemSchema>
