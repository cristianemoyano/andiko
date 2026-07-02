'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '@/lib/fetch-json'
import type { SearchableSelectOption } from './SearchableSelect'

type WarehouseRow = { id: string; name: string }

/**
 * Resuelve el depósito de la sucursal (único activo con branch_id) y lo preselecciona.
 * La búsqueda queda acotada a depósitos de esa sucursal.
 */
export function useBranchDefaultWarehouse(branchId: string | null) {
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [warehouseOptions, setWarehouseOptions] = useState<SearchableSelectOption[]>([])

  useEffect(() => {
    if (!branchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when branch cleared
      setWarehouseId(null)
      setWarehouseOptions([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const data = await fetchJson<{ data: WarehouseRow[] }>(
          `/api/v1/inventory/warehouses?branch_id=${encodeURIComponent(branchId)}&limit=20`,
        )
        if (cancelled) return
        const opts = (data.data ?? []).map(w => ({ value: w.id, label: w.name }))
        setWarehouseOptions(opts)
        setWarehouseId(opts.length === 1 ? opts[0]!.value : null)
      } catch {
        if (!cancelled) {
          setWarehouseOptions([])
          setWarehouseId(null)
        }
      }
    })()

    return () => { cancelled = true }
  }, [branchId])

  const searchWarehouses = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    if (!branchId) return []
    try {
      const params = new URLSearchParams({
        search: q,
        limit: '20',
        branch_id: branchId,
      })
      const data = await fetchJson<{ data: WarehouseRow[] }>(`/api/v1/inventory/warehouses?${params}`)
      return (data.data ?? []).map(w => ({ value: w.id, label: w.name }))
    } catch {
      return []
    }
  }, [branchId])

  return { warehouseId, setWarehouseId, warehouseOptions, searchWarehouses }
}
