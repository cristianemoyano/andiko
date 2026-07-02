import { z } from 'zod'
import { paginationSchema } from '@/lib/pagination'

export const vehicleSchema = z.object({
  label:     z.string().min(1).max(120),
  plate:     z.string().max(20).nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  notes:     z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
})

export const vehicleUpdateSchema = vehicleSchema.partial()

export const vehicleQuerySchema = paginationSchema.extend({
  branch_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
  search:    z.string().optional(),
})

export type VehicleInput       = z.infer<typeof vehicleSchema>
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>
export type VehicleQuery       = z.infer<typeof vehicleQuerySchema>

export function formatVehicleRef(vehicle: { label: string; plate: string | null }): string {
  const plate = vehicle.plate?.trim()
  return plate ? `${vehicle.label} (${plate})` : vehicle.label
}
