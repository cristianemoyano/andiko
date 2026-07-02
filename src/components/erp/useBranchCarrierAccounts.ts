'use client'

import { useState, useEffect } from 'react'
import { fetchJson } from '@/lib/fetch-json'
import type { FulfillmentKind } from '@/modules/logistics/logistics.constants'

export type CarrierAccountOption = {
  id: string
  name: string
  kind: FulfillmentKind
}

/**
 * Transportistas activos de la sucursal (+ cuentas globales sin sucursal).
 * Misma fuente que envíos y logística.
 */
export function useBranchCarrierAccounts(branchId: string | null) {
  const [carriers, setCarriers] = useState<CarrierAccountOption[]>([])
  const [carrierId, setCarrierId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!branchId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when branch cleared
      setCarriers([])
      setCarrierId('')
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const params = new URLSearchParams({ is_active: 'true', limit: '100', branch_id: branchId })
        const res = await fetchJson<{ data: CarrierAccountOption[] }>(`/api/v1/logistics/carrier-accounts?${params}`)
        if (cancelled) return
        const rows = res.data ?? []
        setCarriers(rows)
        setCarrierId(prev => prev || (rows[0]?.id ?? ''))
      } catch {
        if (!cancelled) {
          setCarriers([])
          setCarrierId('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [branchId])

  return { carriers, carrierId, setCarrierId, loading }
}
