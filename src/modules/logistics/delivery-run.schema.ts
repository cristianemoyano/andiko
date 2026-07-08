import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'
import {
  DELIVERY_RUN_STATUSES,
  DELIVERY_STOP_STATUSES,
  FULFILLMENT_KINDS,
} from './logistics.constants'

const shipmentIdsSchema = z.array(z.string().uuid()).min(1).max(100)

export const deliveryRunSchema = z.object({
  branch_id:          z.string().uuid().optional(),
  planned_date:       z.coerce.date().optional(),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
  carrier_account_id: z.string().uuid().nullable().optional(),
  provider_kind:      z.enum(FULFILLMENT_KINDS).optional(),
  notes:              z.string().max(2000).nullable().optional(),
  shipment_ids:       shipmentIdsSchema,
})

export const deliveryRunUpdateSchema = z.object({
  planned_date:       z.coerce.date().optional(),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
  carrier_account_id: z.string().uuid().nullable().optional(),
  provider_kind:      z.enum(FULFILLMENT_KINDS).optional(),
  notes:              z.string().max(2000).nullable().optional(),
})

export const deliveryRunAddShipmentsSchema = z.object({
  shipment_ids: shipmentIdsSchema,
})

export const deliveryRunDispatchSchema = z.object({
  assigned_driver_id: z.string().uuid().nullable().optional(),
  vehicle_id:         z.string().uuid().nullable().optional(),
  vehicle_ref:        z.string().max(60).nullable().optional(),
})

export const deliveryRunCancelSchema = z.object({
  reason: z.string().max(255).optional(),
})

export const deliveryStopDeliverSchema = z.object({
  status:                 z.enum(['delivered', 'partial', 'failed', 'returned']).default('delivered'),
  delivered_at:           z.coerce.date().optional(),
  description:            z.string().max(255).nullable().optional(),
  delivery_result_reason: z.string().max(60).nullable().optional(),
  delivery_result_notes:  z.string().max(2000).nullable().optional(),
})

export const deliveryRunQuerySchema = paginationSchema.extend({
  branch_id:          z.string().uuid().optional(),
  status:             z.enum(DELIVERY_RUN_STATUSES).optional(),
  assigned_driver_id: z.string().uuid().optional(),
  planned_from:       z.coerce.date().optional(),
  planned_to:         z.coerce.date().optional(),
  search:             z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.planned_from && value.planned_to && value.planned_from > value.planned_to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'planned_from must be <= planned_to',
      path: ['planned_from'],
    })
  }
})

export const eligibleShipmentQuerySchema = paginationSchema.extend({
  branch_id:          z.string().uuid().optional(),
  status:             z.enum(['pending', 'ready_to_ship']).optional(),
  provider_kind:      z.enum(FULFILLMENT_KINDS).optional(),
  assigned_driver_id: z.string().uuid().optional(),
  promised_from:      z.coerce.date().optional(),
  promised_to:        z.coerce.date().optional(),
  postal_code:        z.string().max(10).optional(),
  search:             z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.promised_from && value.promised_to && value.promised_from > value.promised_to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'promised_from must be <= promised_to',
      path: ['promised_from'],
    })
  }
})

export const deliveryStopStatusSchema = z.enum(DELIVERY_STOP_STATUSES)

export type DeliveryRunInput = z.infer<typeof deliveryRunSchema>
export type DeliveryRunUpdateInput = z.infer<typeof deliveryRunUpdateSchema>
export type DeliveryRunAddShipmentsInput = z.infer<typeof deliveryRunAddShipmentsSchema>
export type DeliveryRunDispatchInput = z.infer<typeof deliveryRunDispatchSchema>
export type DeliveryRunCancelInput = z.infer<typeof deliveryRunCancelSchema>
export type DeliveryStopDeliverInput = z.infer<typeof deliveryStopDeliverSchema>
export type DeliveryRunQuery = z.infer<typeof deliveryRunQuerySchema>
export type EligibleShipmentQuery = z.infer<typeof eligibleShipmentQuerySchema>
