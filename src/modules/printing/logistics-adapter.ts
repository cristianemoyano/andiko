import 'server-only'
import { Op } from 'sequelize'
import type { TenantContext } from '@/lib/tenancy'
import type { PrintableDocument, PrintableRouteControlStop } from '@/types/printing'
import { getDeliveryRun } from '@/modules/logistics/delivery-runs.service'
import DeliveryNote from '@/modules/inventory/delivery-note.model'
import {
  DELIVERY_RUN_STATUS_LABEL,
  DELIVERY_STOP_STATUS_LABEL,
  SHIPMENT_STATUS_LABEL,
  type DeliveryRunStatus,
  type DeliveryStopStatus,
  type ShipmentStatus,
} from '@/modules/logistics/logistics.constants'
import { getPrintHeader } from './issuer'
import { assertPrintAccess } from './tenant-guards'
import { decString, formatDateArg } from './format-utils'

type ShipmentForPrint = {
  id: string
  shipment_number: string
  status: ShipmentStatus
  tracking_number: string | null
  delivery_notes: string | null
  delivery_result_reason: string | null
  delivery_result_notes: string | null
  salesOrder?: { order_number: string } | null
  items?: Array<{ description: string; quantity: unknown }>
}

type StopForPrint = {
  sequence: number
  status: DeliveryStopStatus
  ship_to_name: string | null
  ship_to_phone: string | null
  ship_street: string | null
  ship_number: string | null
  ship_floor: string | null
  ship_apartment: string | null
  ship_city: string | null
  ship_province: string | null
  ship_postal_code: string | null
  ship_country: string | null
  delivered_at: Date | string | null
  failure_reason: string | null
  delivery_result_reason: string | null
  delivery_result_notes: string | null
  shipments?: ShipmentForPrint[]
}

type RunForPrint = {
  branch_id: string
  run_number: string
  status: DeliveryRunStatus
  planned_date: Date | string
  vehicle_ref: string | null
  notes: string | null
  driver?: { name: string } | null
  carrierAccount?: { name: string } | null
  stops: StopForPrint[]
}

type DeliveryNoteForPrint = {
  shipment_id: string | null
  delivery_number: string
  status: string
}

function formatStopAddress(stop: StopForPrint): string | null {
  const first = `${stop.ship_street ?? ''}${stop.ship_number ? ` ${stop.ship_number}` : ''}`.trim()
  const floorApt = [stop.ship_floor, stop.ship_apartment].filter(Boolean).join(' ')
  const parts = [first, floorApt, stop.ship_city, stop.ship_province, stop.ship_postal_code, stop.ship_country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export async function buildDeliveryRunControlPrintable(id: string, ctx: TenantContext): Promise<PrintableDocument> {
  const run = (await getDeliveryRun(id, ctx)) as unknown as RunForPrint
  assertPrintAccess({ org_id: ctx.orgId, branch_id: run.branch_id }, ctx)

  const { issuer, template } = await getPrintHeader(ctx.orgId)
  const shipmentIds = run.stops.flatMap(stop => stop.shipments ?? []).map(shipment => shipment.id)
  const notes = shipmentIds.length > 0
    ? await DeliveryNote.findAll({
        where: {
          shipment_id: { [Op.in]: shipmentIds },
          org_id: ctx.orgId,
          status: { [Op.ne]: 'annulled' },
        },
        attributes: ['shipment_id', 'delivery_number', 'status'],
        order: [['created_at', 'DESC']],
      })
    : []
  const noteByShipmentId = new Map(
    notes.map(note => note.get({ plain: true }) as DeliveryNoteForPrint)
      .filter(note => note.shipment_id)
      .map(note => [note.shipment_id as string, note]),
  )

  const stops: PrintableRouteControlStop[] = run.stops.map(stop => ({
    sequence: stop.sequence,
    status_label: DELIVERY_STOP_STATUS_LABEL[stop.status] ?? stop.status,
    customer_name: stop.ship_to_name,
    phone: stop.ship_to_phone,
    address: formatStopAddress(stop),
    delivered_at: formatDateArg(stop.delivered_at),
    result_reason: stop.delivery_result_reason ?? stop.failure_reason ?? null,
    result_notes: stop.delivery_result_notes ?? null,
    shipments: (stop.shipments ?? []).map(shipment => {
      const note = noteByShipmentId.get(shipment.id)
      return {
        shipment_number: shipment.shipment_number,
        order_number: shipment.salesOrder?.order_number ?? null,
        delivery_note_number: note?.delivery_number ?? null,
        delivery_note_status: note?.status ?? null,
        status_label: SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status,
        tracking_number: shipment.tracking_number,
        delivery_notes: shipment.delivery_notes,
        result_reason: shipment.delivery_result_reason,
        result_notes: shipment.delivery_result_notes,
        lines: (shipment.items ?? []).map(item => ({
          description: item.description,
          quantity: decString(item.quantity),
        })),
      }
    }),
  }))

  return {
    domain: 'logistics',
    kind: 'delivery_run_control',
    isDraft: run.status === 'draft',
    issuer,
    template,
    title: 'Control de reparto',
    document_number: run.run_number,
    status_code: run.status,
    status_label: DELIVERY_RUN_STATUS_LABEL[run.status] ?? run.status,
    currency: 'ARS',
    payment_condition: null,
    payment_condition_label: null,
    counterparty_role: 'customer',
    counterparty: null,
    branch: null,
    meta_dates: [
      { label: 'Fecha planificada', value: formatDateArg(run.planned_date) },
      { label: 'Repartidor', value: run.driver?.name ?? null },
      { label: 'Vehículo', value: run.vehicle_ref ?? null },
      { label: 'Transporte', value: run.carrierAccount?.name ?? null },
    ],
    lines: [],
    totals: { subtotal: '0.00', discount_amount: null, tax_amount: '0.00', total: '0.00' },
    notes: run.notes ?? null,
    payments: null,
    route_control: { stops },
  }
}
