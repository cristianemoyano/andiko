'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, TablePagination, ShipmentStatusBadge, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { DatePicker } from '@/components/primitives/DatePicker'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { FULFILLMENT_KIND_LABEL } from '@/modules/logistics/logistics.constants'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifySuccess } from '@/lib/notify'
import { LogisticaSubNav } from '../../LogisticaSubNav'
import { formatShipmentDestination, type DriverOption, type ShipmentListRow, type VehicleOption } from '../../types'

const PAGE_SIZE = 20

const COLUMNS: Column<ShipmentListRow>[] = [
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

export function NuevaSalidaClient() {
  const router = useRouter()
  const [rows, setRows] = useState<ShipmentListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [plannedDate, setPlannedDate] = useState<Date | null>(() => new Date())
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams({
      page:  String(page),
      limit: String(PAGE_SIZE),
      ...(search ? { search } : {}),
      ...(postalCode ? { postal_code: postalCode } : {}),
    })
    void (async () => {
      setListError(null)
      try {
        const data = await fetchJson<{ data: ShipmentListRow[]; total: number }>(`/api/v1/logistics/delivery-runs/eligible-shipments?${params}`)
        if (!mounted) return
        const nextTotal = typeof data.total === 'number' ? data.total : 0
        setRows(Array.isArray(data.data) ? data.data : [])
        setTotal(nextTotal)
        const pages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (err) {
        if (!mounted) return
        setListError(getApiErrorMessage(err))
        setRows([])
        setTotal(0)
      }
    })()
    return () => { mounted = false }
  }, [page, search, postalCode])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          fetchJson<{ data: DriverOption[] }>('/api/v1/logistics/drivers'),
          fetchJson<{ data: VehicleOption[] }>('/api/v1/logistics/vehicles?is_active=true&limit=100'),
        ])
        if (!cancelled) {
          setDrivers(driversRes.data ?? [])
          setVehicles(vehiclesRes.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setDrivers([])
          setVehicles([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const pageIds = useMemo(() => rows.map(row => row.id), [rows])

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setServerError(null)
  }

  function toggleAllOnPage() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = pageIds.length > 0 && pageIds.every(id => next.has(id))
      for (const id of pageIds) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
    setServerError(null)
  }

  async function handleCreate() {
    if (selectedIds.size === 0) {
      setServerError('Seleccioná al menos un envío para armar la salida.')
      return
    }
    setSaving(true)
    setServerError(null)
    try {
      const run = await fetchJson<{ id: string; run_number: string }>('/api/v1/logistics/delivery-runs', {
        method: 'POST',
        body: JSON.stringify({
          shipment_ids: [...selectedIds],
          ...(plannedDate ? { planned_date: plannedDate.toISOString() } : {}),
          ...(driverId ? { assigned_driver_id: driverId } : {}),
          ...(vehicleId ? { vehicle_id: vehicleId } : {}),
        }),
      })
      notifySuccess(`Salida ${run.run_number} creada`)
      router.push(`/logistica/salidas/${run.id}`)
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: 'Logística', href: '/logistica/salidas' }, { label: 'Salidas', href: '/logistica/salidas' }, { label: 'Nueva' }]} />
      <LogisticaSubNav />

      <PageBody>
        <div className="mb-4 rounded-md border border-border bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <FormField label="Fecha planificada" htmlFor="planned_date">
              <DatePicker id="planned_date" value={plannedDate} onChange={setPlannedDate} />
            </FormField>
            <FormField label="Repartidor" htmlFor="driver_id">
              <Select
                id="driver_id"
                value={driverId}
                onChange={setDriverId}
                options={[{ value: '', label: 'Sin asignar' }, ...drivers.map(driver => ({ value: driver.id, label: driver.name }))]}
              />
            </FormField>
            <FormField label="Vehículo" htmlFor="vehicle_id">
              <Select
                id="vehicle_id"
                value={vehicleId}
                onChange={setVehicleId}
                options={[
                  { value: '', label: 'Sin vehículo' },
                  ...vehicles.map(vehicle => ({
                    value: vehicle.id,
                    label: vehicle.plate ? `${vehicle.label} (${vehicle.plate})` : vehicle.label,
                  })),
                ]}
              />
            </FormField>
            <div className="flex items-end justify-end gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/logistica/salidas">Cancelar</Link>
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? 'Creando…' : `Crear salida (${selectedIds.size})`}
              </Button>
            </div>
          </div>
          {serverError && (
            <div className="mt-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
              {serverError}
            </div>
          )}
        </div>

        {listError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">
            {listError}
          </div>
        )}
        <DataTable
          columns={COLUMNS}
          data={rows}
          keyExtractor={row => row.id}
          emptyMessage="No hay envíos pendientes disponibles para agrupar."
          selection={{
            selectedIds,
            pageIds,
            onToggleRow: toggleRow,
            onToggleAllOnPage: toggleAllOnPage,
          }}
          toolbar={
            <>
              <Input
                className="h-[30px] w-full sm:w-56"
                placeholder="Buscar envío, pedido o destino…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
              <Input
                className="h-[30px] w-full sm:w-28"
                placeholder="CP"
                value={postalCode}
                onChange={e => { setPostalCode(e.target.value); setPage(1) }}
              />
              <span className="flex-1" />
              <span className="text-[12px] text-fg-muted">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''} · {total} disponible{total !== 1 ? 's' : ''}
              </span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      </PageBody>
    </div>
  )
}
