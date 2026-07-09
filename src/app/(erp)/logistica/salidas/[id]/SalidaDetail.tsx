'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, ShipmentStatusBadge, TablePagination, type Column } from '@/components/erp'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { EmptyState } from '@/components/erp/EmptyState'
import { PageActionBar, type PageAction } from '@/components/erp/PageActionBar'
import { Button } from '@/components/primitives/Button'
import { DatePicker } from '@/components/primitives/DatePicker'
import { Dialog, DialogFooter } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Textarea } from '@/components/primitives/Textarea'
import {
  DELIVERY_RUN_STATUS_LABEL,
  DELIVERY_STOP_STATUS_LABEL,
  FULFILLMENT_KIND_LABEL,
  type DeliveryRunStatus,
  type DeliveryStopStatus,
} from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { LogisticaSubNav } from '../../LogisticaSubNav'
import { formatShipmentDestination, formatStopDestination, type DeliveryRunDetailData, type DeliveryStopRow, type DriverOption, type ShipmentDetailData, type ShipmentListRow, type VehicleOption } from '../../types'

const ADD_SHIPMENTS_PAGE_SIZE = 10

const ADD_SHIPMENT_COLUMNS: Column<ShipmentListRow>[] = [
  {
    key: 'shipment_number',
    header: 'Envío',
    render: row => <span className="font-medium text-fg">{row.shipment_number}</span>,
  },
  {
    key: 'order',
    header: 'Pedido',
    render: row => row.salesOrder
      ? <span className="text-[12px] text-fg-muted">{row.salesOrder.order_number}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'destination',
    header: 'Destino',
    render: row => <span className="text-[12px] text-fg-muted">{formatShipmentDestination(row)}</span>,
  },
  {
    key: 'postal_code',
    header: 'CP',
    render: row => row.ship_postal_code
      ? <span className="text-[12px] tabular-nums text-fg-muted">{row.ship_postal_code}</span>
      : <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'provider',
    header: 'Transporte',
    render: row => (
      <span className="text-[12px] text-fg-muted">
        {row.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[row.provider_kind]}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: row => <ShipmentStatusBadge status={row.status} />,
  },
]

function RunStatusBadge({ status }: { status: DeliveryRunStatus }) {
  const tone = {
    draft:       'bg-surface-muted text-fg-muted border-border',
    planned:     'bg-blue-50 text-blue-700 border-blue-200',
    dispatched:  'bg-amber-50 text-amber-700 border-amber-200',
    in_progress: 'bg-brand-accent-bg text-brand-accent border-brand-200',
    completed:   'bg-green-50 text-green-700 border-green-200',
    cancelled:   'bg-danger-bg text-danger border-danger',
  }[status]
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{DELIVERY_RUN_STATUS_LABEL[status]}</span>
}

function StopStatusBadge({ status }: { status: DeliveryStopStatus }) {
  const tone = {
    pending:   'bg-surface-muted text-fg-muted border-border',
    arrived:   'bg-amber-50 text-amber-700 border-amber-200',
    delivered: 'bg-green-50 text-green-700 border-green-200',
    partial:   'bg-warning-bg text-warning border-warning',
    failed:    'bg-danger-bg text-danger border-danger',
    returned:  'bg-warning-bg text-warning border-warning',
    skipped:   'bg-slate-50 text-slate-700 border-slate-200',
  }[status]
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{DELIVERY_STOP_STATUS_LABEL[status]}</span>
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-')
    return year && month && day ? `${day}/${month}/${year}` : '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-AR')
}

function dateOnlyToUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null
}

function formatAddress(stop: DeliveryStopRow): string {
  const street = `${stop.ship_street ?? ''}${stop.ship_number ? ` ${stop.ship_number}` : ''}`.trim()
  const floorApt = [stop.ship_floor, stop.ship_apartment].filter(Boolean).join(' ')
  return [street, floorApt, stop.ship_city, stop.ship_province, stop.ship_postal_code, stop.ship_country].filter(Boolean).join(', ') || 'Sin dirección'
}

export function SalidaDetail({ id }: { id: string }) {
  const [run, setRun] = useState<DeliveryRunDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editPlannedDate, setEditPlannedDate] = useState<Date | null>(null)
  const [editDriverId, setEditDriverId] = useState('')
  const [editVehicleId, setEditVehicleId] = useState('')
  const [editVehicleRef, setEditVehicleRef] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [eligibleRows, setEligibleRows] = useState<ShipmentListRow[]>([])
  const [eligibleTotal, setEligibleTotal] = useState(0)
  const [eligiblePage, setEligiblePage] = useState(1)
  const [eligibleSearch, setEligibleSearch] = useState('')
  const [eligiblePostalCode, setEligiblePostalCode] = useState('')
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<Set<string>>(() => new Set())
  const [addError, setAddError] = useState<string | null>(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [resultStop, setResultStop] = useState<DeliveryStopRow | null>(null)
  const [resultStatus, setResultStatus] = useState<'delivered' | 'partial' | 'failed' | 'returned'>('delivered')
  const [resultReason, setResultReason] = useState('')
  const [resultNotes, setResultNotes] = useState('')
  const [savingResult, setSavingResult] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const data = await fetchJson<DeliveryRunDetailData>(`/api/v1/logistics/delivery-runs/${id}`)
        if (!cancelled) setRun(data)
      } catch {
        if (!cancelled) setRun(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  useEffect(() => {
    if (!editOpen) return

    let cancelled = false
    void (async () => {
      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          fetchJson<{ data: DriverOption[] }>('/api/v1/logistics/drivers'),
          fetchJson<{ data: VehicleOption[] }>('/api/v1/logistics/vehicles?is_active=true&limit=100'),
        ])
        if (cancelled) return
        setDrivers(driversRes.data ?? [])
        setVehicles(vehiclesRes.data ?? [])
      } catch (err) {
        if (cancelled) return
        setDrivers([])
        setVehicles([])
        setEditError(getApiErrorMessage(err))
      }
    })()

    return () => { cancelled = true }
  }, [editOpen])

  useEffect(() => {
    if (!addOpen || !run) return

    let cancelled = false
    const params = new URLSearchParams({
      page:          String(eligiblePage),
      limit:         String(ADD_SHIPMENTS_PAGE_SIZE),
      branch_id:     run.branch_id,
      provider_kind: run.provider_kind,
      ...(eligibleSearch ? { search: eligibleSearch } : {}),
      ...(eligiblePostalCode ? { postal_code: eligiblePostalCode } : {}),
    })

    void (async () => {
      setAddError(null)
      try {
        const data = await fetchJson<{ data: ShipmentListRow[]; total: number }>(`/api/v1/logistics/delivery-runs/eligible-shipments?${params}`)
        if (cancelled) return
        const nextTotal = typeof data.total === 'number' ? data.total : 0
        setEligibleRows(Array.isArray(data.data) ? data.data : [])
        setEligibleTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / ADD_SHIPMENTS_PAGE_SIZE))
        setEligiblePage(page => (page > pages ? pages : page))
      } catch (err) {
        if (cancelled) return
        setEligibleRows([])
        setEligibleTotal(0)
        setAddError(getApiErrorMessage(err))
      }
    })()

    return () => { cancelled = true }
  }, [addOpen, eligiblePage, eligiblePostalCode, eligibleSearch, run])

  async function mutate(path: string, success: string, init?: RequestInit) {
    if (!run) return
    setTransitioning(true)
    try {
      await fetchJson(path, init ?? { method: 'POST' })
      notifySuccess(success)
      setRefresh(value => value + 1)
    } catch (err) {
      notifyApiError(err)
    } finally {
      setTransitioning(false)
    }
  }

  async function handleDispatch() {
    if (!run) return
    await mutate(`/api/v1/logistics/delivery-runs/${run.id}/dispatch`, `Salida ${run.run_number} despachada`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  }

  async function handleCancel() {
    if (!run) return
    await mutate(`/api/v1/logistics/delivery-runs/${run.id}/cancel`, `Salida ${run.run_number} cancelada`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Salida cancelada desde logística' }),
    })
    setConfirmCancel(false)
  }

  function openResultDialog(stop: DeliveryStopRow) {
    setResultStop(stop)
    setResultStatus('delivered')
    setResultReason('')
    setResultNotes('')
  }

  async function handleSaveStopResult() {
    if (!run || !resultStop) return
    setSavingResult(true)
    setTransitioning(true)
    try {
      await fetchJson(`/api/v1/logistics/delivery-runs/${run.id}/stops/${resultStop.id}/deliver`, {
        method: 'POST',
        body: JSON.stringify({
          status: resultStatus,
          delivery_result_reason: resultReason.trim() || null,
          delivery_result_notes: resultNotes.trim() || null,
        }),
      })
      notifySuccess(`Resultado de parada ${resultStop.sequence} registrado`)
      setResultStop(null)
      setRefresh(value => value + 1)
    } catch (err) {
      notifyApiError(err)
    } finally {
      setSavingResult(false)
      setTransitioning(false)
    }
  }

  async function handleRemoveShipment(shipment: ShipmentDetailData) {
    if (!run) return
    await mutate(
      `/api/v1/logistics/delivery-runs/${run.id}/shipments/${shipment.id}`,
      `Envío ${shipment.shipment_number} quitado de la salida`,
      { method: 'DELETE' },
    )
  }

  function openEditModal() {
    if (!run) return
    setEditPlannedDate(dateOnlyToUtcDate(run.planned_date))
    setEditDriverId(run.assigned_driver_id ?? '')
    setEditVehicleId(run.vehicle_id ?? '')
    setEditVehicleRef(run.vehicle_id ? '' : (run.vehicle_ref ?? ''))
    setEditNotes(run.notes ?? '')
    setEditError(null)
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!run) return
    setSavingEdit(true)
    setEditError(null)
    try {
      await fetchJson(`/api/v1/logistics/delivery-runs/${run.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(editPlannedDate ? { planned_date: editPlannedDate.toISOString() } : {}),
          assigned_driver_id: editDriverId || null,
          ...(editVehicleId
            ? { vehicle_id: editVehicleId }
            : { vehicle_ref: editVehicleRef.trim() || null }),
          notes: editNotes.trim() || null,
        }),
      })
      notifySuccess(`Salida ${run.run_number} actualizada`)
      setEditOpen(false)
      setRefresh(value => value + 1)
    } catch (err) {
      setEditError(getApiErrorMessage(err))
    } finally {
      setSavingEdit(false)
    }
  }

  function openAddShipmentsModal() {
    setEligiblePage(1)
    setEligibleSearch('')
    setEligiblePostalCode('')
    setSelectedShipmentIds(new Set())
    setAddError(null)
    setAddOpen(true)
  }

  function toggleEligibleShipment(id: string) {
    setSelectedShipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setAddError(null)
  }

  function toggleAllEligibleOnPage() {
    setSelectedShipmentIds(prev => {
      const next = new Set(prev)
      const pageIds = eligibleRows.map(row => row.id)
      const allSelected = pageIds.length > 0 && pageIds.every(id => next.has(id))
      for (const id of pageIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setAddError(null)
  }

  async function handleAddShipments() {
    if (!run) return
    if (selectedShipmentIds.size === 0) {
      setAddError('Seleccioná al menos un envío para agregar a la salida.')
      return
    }

    setSavingAdd(true)
    setAddError(null)
    try {
      await fetchJson(`/api/v1/logistics/delivery-runs/${run.id}/shipments`, {
        method: 'POST',
        body: JSON.stringify({ shipment_ids: [...selectedShipmentIds] }),
      })
      notifySuccess(`${selectedShipmentIds.size} envío${selectedShipmentIds.size !== 1 ? 's' : ''} agregado${selectedShipmentIds.size !== 1 ? 's' : ''} a la salida`)
      setAddOpen(false)
      setSelectedShipmentIds(new Set())
      setRefresh(value => value + 1)
    } catch (err) {
      setAddError(getApiErrorMessage(err))
    } finally {
      setSavingAdd(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/salidas' }, { label: 'Salidas' }]} />
        <LogisticaSubNav />
        <PageBody>
          <div className="rounded border border-border bg-surface p-6 text-sm text-fg-muted">Cargando salida…</div>
        </PageBody>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/salidas' }, { label: 'Salidas' }]} />
        <LogisticaSubNav />
        <PageBody>
          <EmptyState title="Salida no encontrada" description="Puede haber sido eliminada o no tenés acceso a la sucursal." />
        </PageBody>
      </div>
    )
  }

  const editable = run.status === 'draft' || run.status === 'planned'
  const canDispatch = run.status === 'planned' && run.shipment_count > 0
  const eligiblePageIds = eligibleRows.map(row => row.id)
  const actions: PageAction[] = [
    { id: 'back', label: 'Volver a salidas', href: '/logistica/salidas' },
    { id: 'print-control', label: 'Imprimir control de reparto', href: `/logistica/salidas/${run.id}/print`, openInNewTab: true },
    { id: 'edit', label: 'Editar salida', onClick: openEditModal, hidden: !editable },
    { id: 'add-shipments', label: 'Agregar envíos', onClick: openAddShipmentsModal, hidden: !editable },
    { id: 'cancel', label: 'Cancelar salida', onClick: () => setConfirmCancel(true), variant: 'destructive', hidden: !editable },
  ]

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Logística', href: '/logistica/salidas' }, { label: 'Salidas', href: '/logistica/salidas' }, { label: run.run_number }]}
        actions={
          <PageActionBar
            primary={{ id: 'dispatch', label: transitioning ? 'Procesando…' : 'Despachar salida', onClick: handleDispatch, disabled: !canDispatch || transitioning, hidden: !canDispatch }}
            secondary={actions}
          />
        }
      />
      <LogisticaSubNav />

      <PageBody>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Salida</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg font-semibold text-fg">{run.run_number}</span>
              <RunStatusBadge status={run.status} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Planificada</p>
            <p className="mt-2 text-sm text-fg">{formatDate(run.planned_date)}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Reparto</p>
            <p className="mt-2 text-sm text-fg">{run.driver?.name ?? 'Sin repartidor'}</p>
            <p className="text-[12px] text-fg-muted">{run.vehicle_ref ?? 'Sin vehículo'}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">Transporte</p>
            <p className="mt-2 text-sm text-fg">{run.carrierAccount?.name ?? FULFILLMENT_KIND_LABEL[run.provider_kind]}</p>
            <p className="text-[12px] text-fg-muted">{run.shipment_count} envío{run.shipment_count !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-fg">Paradas y envíos</h2>
            <p className="text-[12px] text-fg-muted">Agregá o quitá envíos mientras la salida no fue despachada.</p>
          </div>
          {editable && (
            <Button size="sm" variant="secondary" onClick={openAddShipmentsModal}>
              Agregar envíos
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {run.stops.length === 0 ? (
            <EmptyState title="Sin paradas" description="Agregá envíos a la salida para generar las paradas." />
          ) : (
            run.stops.map(stop => (
              <section key={stop.id} className="rounded-md border border-border bg-surface">
                <header className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-fg">Parada {stop.sequence}</span>
                      <StopStatusBadge status={stop.status} />
                    </div>
                    <p className="mt-1 text-[12px] text-fg-muted">{formatStopDestination(stop)}</p>
                    <p className="text-[12px] text-fg-subtle">{formatAddress(stop)}</p>
                  </div>
                  {(run.status === 'dispatched' || run.status === 'in_progress') && !['delivered', 'partial', 'failed', 'returned', 'skipped'].includes(stop.status) && (
                    <Button size="sm" onClick={() => openResultDialog(stop)} disabled={transitioning}>
                      Registrar resultado
                    </Button>
                  )}
                </header>
                {(stop.failure_reason || stop.delivery_result_reason || stop.delivery_result_notes) && (
                  <div className="border-t border-border px-4 py-2 text-[12px] text-fg-muted">
                    {stop.delivery_result_reason && <p className="font-medium text-fg">{stop.delivery_result_reason}</p>}
                    {stop.failure_reason && <p>{stop.failure_reason}</p>}
                    {stop.delivery_result_notes && <p className="whitespace-pre-wrap">{stop.delivery_result_notes}</p>}
                  </div>
                )}
                <div className="divide-y divide-border">
                  {stop.shipments.map(shipment => (
                    <div key={shipment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link href={`/logistica/envios/${shipment.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                            {shipment.shipment_number}
                          </Link>
                          <ShipmentStatusBadge status={shipment.status} />
                        </div>
                        <p className="text-[12px] text-fg-muted">
                          Pedido {shipment.salesOrder?.order_number ?? '—'} · {shipment.items?.length ?? 0} ítem{(shipment.items?.length ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {editable && (
                        <Button variant="secondary" size="xs" onClick={() => handleRemoveShipment(shipment)} disabled={transitioning}>
                          Quitar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </PageBody>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar salida"
        description={`La salida ${run.run_number} quedará cancelada. Los envíos no se cancelan ni modifican sus cantidades.`}
        confirmLabel="Cancelar salida"
        onConfirm={handleCancel}
      />

      <Dialog
        open={editOpen}
        onOpenChange={open => { if (!open && !savingEdit) setEditOpen(false) }}
        title={`Editar salida ${run.run_number}`}
        description="Actualizá los datos operativos antes del despacho."
        size="md"
        footer={
          <DialogFooter error={editError}>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        }
      >
        <div className="grid gap-4">
          <FormField label="Fecha planificada" htmlFor="edit_planned_date">
            <DatePicker id="edit_planned_date" value={editPlannedDate} onChange={setEditPlannedDate} />
          </FormField>

          <FormField label="Repartidor" htmlFor="edit_driver_id">
            <Select
              id="edit_driver_id"
              value={editDriverId}
              onChange={setEditDriverId}
              options={[{ value: '', label: 'Sin asignar' }, ...drivers.map(driver => ({ value: driver.id, label: driver.name }))]}
            />
          </FormField>

          <FormField label="Vehículo" htmlFor="edit_vehicle_id">
            <Select
              id="edit_vehicle_id"
              value={editVehicleId}
              onChange={(value) => {
                setEditVehicleId(value)
                if (value) setEditVehicleRef('')
              }}
              options={[
                { value: '', label: 'Sin vehículo / referencia manual' },
                ...vehicles.map(vehicle => ({
                  value: vehicle.id,
                  label: vehicle.plate ? `${vehicle.label} (${vehicle.plate})` : vehicle.label,
                })),
              ]}
            />
          </FormField>

          <FormField label="Referencia de vehículo" htmlFor="edit_vehicle_ref">
            <Input
              id="edit_vehicle_ref"
              value={editVehicleRef}
              onChange={event => setEditVehicleRef(event.target.value)}
              placeholder="Ej: Camioneta externa"
              disabled={!!editVehicleId}
            />
          </FormField>

          <FormField label="Notas" htmlFor="edit_notes">
            <Textarea
              id="edit_notes"
              value={editNotes}
              onChange={event => setEditNotes(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Observaciones internas de la salida"
            />
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={!!resultStop}
        onOpenChange={open => { if (!open && !savingResult) setResultStop(null) }}
        title={resultStop ? `Resultado parada ${resultStop.sequence}` : 'Resultado de parada'}
        description="Registrá qué pasó en la entrega. La razón se verá en el control de reparto."
        footer={
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setResultStop(null)} disabled={savingResult}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveStopResult} disabled={savingResult || ((resultStatus === 'failed' || resultStatus === 'returned' || resultStatus === 'partial') && !resultReason.trim())}>
              {savingResult ? 'Guardando…' : 'Guardar resultado'}
            </Button>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <FormField label="Resultado" htmlFor="stop_result_status">
            <Select
              id="stop_result_status"
              value={resultStatus}
              onChange={value => setResultStatus(value as typeof resultStatus)}
              options={[
                { value: 'delivered', label: 'Entregado' },
                { value: 'partial', label: 'Parcial' },
                { value: 'failed', label: 'Fallido' },
                { value: 'returned', label: 'Devuelto' },
              ]}
            />
          </FormField>

          <FormField label="Razón" htmlFor="stop_result_reason">
            <Input
              id="stop_result_reason"
              value={resultReason}
              onChange={event => setResultReason(event.target.value)}
              placeholder={resultStatus === 'delivered' ? 'Opcional' : 'Ej: cliente ausente, rechazo, faltó un bulto'}
              maxLength={60}
            />
          </FormField>

          <FormField label="Notas" htmlFor="stop_result_notes">
            <Textarea
              id="stop_result_notes"
              value={resultNotes}
              onChange={event => setResultNotes(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Detalle para el control de reparto"
            />
          </FormField>
        </div>
      </Dialog>

      <Dialog
        open={addOpen}
        onOpenChange={open => { if (!open && !savingAdd) setAddOpen(false) }}
        title={`Agregar envíos a ${run.run_number}`}
        description="Seleccioná envíos pendientes compatibles con la sucursal y el tipo de transporte de la salida."
        size="xl"
        padded={false}
        footer={
          <DialogFooter error={addError}>
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)} disabled={savingAdd}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddShipments} disabled={savingAdd || selectedShipmentIds.size === 0}>
              {savingAdd ? 'Agregando…' : `Agregar envíos (${selectedShipmentIds.size})`}
            </Button>
          </DialogFooter>
        }
      >
        <div className="p-4">
          <DataTable
            columns={ADD_SHIPMENT_COLUMNS}
            data={eligibleRows}
            keyExtractor={row => row.id}
            emptyMessage="No hay envíos pendientes compatibles para agregar."
            selection={{
              selectedIds: selectedShipmentIds,
              pageIds: eligiblePageIds,
              onToggleRow: toggleEligibleShipment,
              onToggleAllOnPage: toggleAllEligibleOnPage,
            }}
            toolbar={
              <>
                <Input
                  className="h-[30px] w-full sm:w-56"
                  placeholder="Buscar envío, pedido o destino…"
                  value={eligibleSearch}
                  onChange={event => {
                    setEligibleSearch(event.target.value)
                    setEligiblePage(1)
                  }}
                />
                <Input
                  className="h-[30px] w-full sm:w-28"
                  placeholder="CP"
                  value={eligiblePostalCode}
                  onChange={event => {
                    setEligiblePostalCode(event.target.value)
                    setEligiblePage(1)
                  }}
                />
                <span className="flex-1" />
                <span className="text-[12px] text-fg-muted">
                  {selectedShipmentIds.size} seleccionado{selectedShipmentIds.size !== 1 ? 's' : ''}
                </span>
              </>
            }
            footer={
              <TablePagination
                page={eligiblePage}
                pageSize={ADD_SHIPMENTS_PAGE_SIZE}
                total={eligibleTotal}
                onPageChange={setEligiblePage}
              />
            }
          />
        </div>
      </Dialog>
    </div>
  )
}
