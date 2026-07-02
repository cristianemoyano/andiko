import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import { SHIPMENT_STATUSES, FULFILLMENT_KINDS } from './logistics.constants'

const shipToFields = {
  ship_to_name:     z.string().max(160).nullable().optional(),
  ship_to_phone:    z.string().max(40).nullable().optional(),
  ship_street:      z.string().max(255).nullable().optional(),
  ship_number:      z.string().max(20).nullable().optional(),
  ship_floor:       z.string().max(20).nullable().optional(),
  ship_apartment:   z.string().max(20).nullable().optional(),
  ship_city:        z.string().max(100).nullable().optional(),
  ship_province:    z.string().max(100).nullable().optional(),
  ship_postal_code: z.string().max(10).nullable().optional(),
  ship_country:     z.string().max(100).nullable().optional(),
}

export const shipmentItemInputSchema = z.object({
  sales_order_item_id: z.string().uuid(),
  quantity:            z.coerce.number().positive(),
})

export const shipmentSchema = z.object({
  sales_order_id:     z.string().uuid(),
  carrier_account_id: z.string().uuid(),
  /** Sin `items`, el envío toma todas las líneas pendientes del pedido. */
  items:              z.array(shipmentItemInputSchema).min(1).optional(),
  warehouse_id:       z.string().uuid().nullable().optional(),
  promised_date:      z.coerce.date().nullable().optional(),
  tracking_number:    z.string().max(120).nullable().optional(),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
  shipping_cost:      z.coerce.number().min(0).optional(),
  delivery_notes:     z.string().nullable().optional(),
  ...shipToFields,
})

export const shipmentDispatchSchema = z.object({
  tracking_number:    z.string().max(120).nullable().optional(),
  shipping_cost:      z.coerce.number().min(0).optional(),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
})

export const shipmentEventInputSchema = z.object({
  status:      z.enum(SHIPMENT_STATUSES),
  description: z.string().max(255).nullable().optional(),
  occurred_at: z.coerce.date().optional(),
})

export const shipmentDeliverSchema = z.object({
  delivered_at: z.coerce.date().optional(),
  description:  z.string().max(255).nullable().optional(),
})

export const shipmentFailSchema = z.object({
  reason: z.string().min(1).max(255),
})

export const shipmentAssignDriverSchema = z.object({
  assigned_driver_id: z.string().uuid(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
})

export const shipmentUpdateSchema = z.object({
  promised_date:      z.coerce.date().nullable().optional(),
  tracking_number:    z.string().max(120).nullable().optional(),
  shipping_cost:      z.coerce.number().min(0).optional(),
  delivery_notes:     z.string().max(2000).nullable().optional(),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
  items:              z.array(shipmentItemInputSchema.extend({
    quantity: z.coerce.number().min(0),
  })).min(1).optional(),
  ...shipToFields,
})

export const shipmentQuerySchema = paginationSchema.extend({
  status:             z.enum(SHIPMENT_STATUSES).optional(),
  provider_kind:      z.enum(FULFILLMENT_KINDS).optional(),
  sales_order_id:     z.string().uuid().optional(),
  branch_id:          z.string().uuid().optional(),
  assigned_driver_id: z.string().uuid().optional(),
  search:             z.string().optional(),
  from:               z.coerce.date().optional(),
  to:                 z.coerce.date().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'from must be <= to',
      path: ['from'],
    })
  }
})

export type ShipmentInput             = z.infer<typeof shipmentSchema>
export type ShipmentItemInput         = z.infer<typeof shipmentItemInputSchema>
export type ShipmentDispatchInput     = z.infer<typeof shipmentDispatchSchema>
export type ShipmentEventInput        = z.infer<typeof shipmentEventInputSchema>
export type ShipmentDeliverInput      = z.infer<typeof shipmentDeliverSchema>
export type ShipmentFailInput         = z.infer<typeof shipmentFailSchema>
export type ShipmentAssignDriverInput = z.infer<typeof shipmentAssignDriverSchema>
export type ShipmentUpdateInput        = z.infer<typeof shipmentUpdateSchema>
export type ShipmentQuery             = z.infer<typeof shipmentQuerySchema>
