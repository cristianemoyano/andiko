import { NextResponse } from 'next/server'
import { tenancyErrorResponse } from '@/lib/tenancy'

const LOGISTICS_ERROR_RESPONSES: Record<string, { status: number; message: string }> = {
  SHIPMENT_NOT_FOUND:               { status: 404, message: 'Envío no encontrado' },
  ORDER_NOT_FOUND:                  { status: 404, message: 'Pedido no encontrado' },
  CARRIER_ACCOUNT_NOT_FOUND:        { status: 404, message: 'Transportista no encontrado' },
  BRANCH_NOT_FOUND:                 { status: 404, message: 'Sucursal no encontrada o inactiva' },
  ORG_CONTEXT_REQUIRED:             { status: 422, message: 'Falta contexto de organización o sucursal' },
  ORDER_NOT_SHIPPABLE:              { status: 422, message: 'El pedido no admite envíos en su estado actual' },
  ORDER_NOT_DELIVERED_FOR_SYNC:     { status: 422, message: 'Solo se puede registrar logística en pedidos entregados' },
  SHIPMENT_BACKFILL_FAILED:         { status: 500, message: 'No se pudo registrar el envío del pedido' },
  ORDER_ITEM_NOT_FOUND:             { status: 422, message: 'Ítem de pedido no encontrado' },
  ORDER_ITEM_NOT_SHIPPABLE:         { status: 422, message: 'Los servicios no se incluyen en envíos' },
  ORDER_ALREADY_FULLY_SHIPPED:      { status: 422, message: 'El pedido ya tiene todos los ítems enviados' },
  SHIPMENT_QTY_EXCEEDS_ORDER:       { status: 422, message: 'La cantidad a enviar supera lo pendiente del pedido' },
  SHIPMENT_ITEMS_REQUIRED:          { status: 422, message: 'El envío debe incluir al menos un ítem con cantidad mayor a cero' },
  SHIPMENT_DELIVERY_NOTE_REQUIRED:  { status: 422, message: 'El envío debe tener un remito emitido antes de despacharse' },
  SHIPMENT_INVALID_TRANSITION:      { status: 422, message: 'El envío no admite esa transición de estado' },
  SHIPMENT_ALREADY_CLOSED:          { status: 422, message: 'El envío ya está cerrado' },
  CARRIER_ACCOUNT_BRANCH_MISMATCH:  { status: 422, message: 'El transportista pertenece a otra sucursal' },
  DRIVER_ONLY_FOR_IN_HOUSE:         { status: 422, message: 'Solo el reparto propio admite repartidor asignado' },
  LOGISTICS_SCOPE_FORBIDDEN:        { status: 403, message: 'No tenés permiso para esta operación de logística' },
  VEHICLE_NOT_FOUND:                { status: 404, message: 'Vehículo no encontrado' },
  PROVIDER_OPERATION_NOT_SUPPORTED: { status: 422, message: 'El transportista no soporta esta operación' },
  DELIVERY_RUN_NOT_FOUND:           { status: 404, message: 'Salida de reparto no encontrada' },
  DELIVERY_STOP_NOT_FOUND:          { status: 404, message: 'Parada no encontrada' },
  DELIVERY_RUN_SHIPMENT_NOT_FOUND:  { status: 404, message: 'El envío no pertenece a esta salida' },
  DELIVERY_RUN_SHIPMENTS_REQUIRED:  { status: 422, message: 'La salida debe tener al menos un envío' },
  DELIVERY_RUN_SHIPMENT_NOT_ELIGIBLE: { status: 422, message: 'Solo se pueden agrupar envíos pendientes o listos para despachar' },
  DELIVERY_RUN_SHIPMENT_ALREADY_ASSIGNED: { status: 409, message: 'Uno de los envíos ya pertenece a una salida activa' },
  DELIVERY_RUN_BRANCH_MISMATCH:     { status: 422, message: 'Todos los envíos de la salida deben pertenecer a la misma sucursal' },
  DELIVERY_RUN_PROVIDER_MISMATCH:   { status: 422, message: 'Todos los envíos de la salida deben usar el mismo transportista' },
  DELIVERY_RUN_INVALID_TRANSITION:  { status: 422, message: 'La salida no admite esa transición de estado' },
  DELIVERY_RUN_ALREADY_CLOSED:      { status: 422, message: 'La salida ya no admite cambios' },
  DELIVERY_RUN_CANCEL_FORBIDDEN:    { status: 422, message: 'Solo se pueden cancelar salidas en borrador o planificadas' },
  DELIVERY_NOTE_SHIPMENT_ALREADY_LINKED: { status: 409, message: 'El envío ya tiene un remito asociado' },
  DELIVERY_NOTE_SHIPMENT_BRANCH_MISMATCH: { status: 422, message: 'El remito y el envío deben pertenecer a la misma sucursal' },
  DELIVERY_NOTE_SHIPMENT_ORDER_MISMATCH: { status: 422, message: 'El remito y el envío deben pertenecer al mismo pedido' },
}

/** Mapea errores de servicios de logística a respuestas estructuradas; rethrow si es desconocido. */
export function logisticsErrorResponse(err: unknown): NextResponse {
  const tenancy = tenancyErrorResponse(err)
  if (tenancy) return tenancy
  if (!(err instanceof Error)) throw err
  const hit = LOGISTICS_ERROR_RESPONSES[err.message]
  if (!hit) throw err
  return NextResponse.json({ error: hit.message, code: err.message }, { status: hit.status })
}
