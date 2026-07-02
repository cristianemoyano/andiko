import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { DELIVERY_NOTE_STATUSES } from './delivery-note.model'

export const deliveryNoteItemSchema = z.object({
  order_item_id: z.string().uuid().nullable().optional(),
  product_id:    z.string().uuid().nullable().optional(),
  variant_id:    z.string().uuid().nullable().optional(),
  description:   z.string().min(1).max(500),
  quantity:      z.coerce.number().positive(),
  sort_order:    z.coerce.number().int().min(0).default(0),
})

export const deliveryNoteSchema = z.object({
  branch_id:       z.string().uuid(),
  order_id:        z.string().uuid().nullable().optional(),
  contact_id:      z.string().uuid().nullable().optional(),
  warehouse_id:    z.string().uuid().nullable().optional(),
  delivery_date:   z.string().datetime({ offset: true }).transform(s => new Date(s)).nullable().optional(),
  carrier_account_id: z.string().uuid().nullable().optional(),
  tracking_code:   z.string().max(100).nullable().optional(),
  ship_to_address: z.string().nullable().optional(),
  notes:           z.string().nullable().optional(),
  internal_notes:  z.string().nullable().optional(),
  items:           z.array(deliveryNoteItemSchema).min(1),
})

export const deliveryNoteUpdateSchema = deliveryNoteSchema.partial().extend({
  items: z.array(deliveryNoteItemSchema).min(1).optional(),
})

export const deliveryNoteQuerySchema = paginationSchema.extend({
  search:       z.string().optional(),
  status:       z.enum(DELIVERY_NOTE_STATUSES).optional(),
  contact_id:   z.string().uuid().optional(),
  order_id:     z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
})

export type DeliveryNoteInput       = z.infer<typeof deliveryNoteSchema>
export type DeliveryNoteUpdateInput = z.infer<typeof deliveryNoteUpdateSchema>
export type DeliveryNoteQuery       = z.infer<typeof deliveryNoteQuerySchema>
export type DeliveryNoteItemInput   = z.infer<typeof deliveryNoteItemSchema>
