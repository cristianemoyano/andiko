import { useEffect, useState } from 'react'
import { ivaConditionLabel } from './pos-fiscal-labels'

export type PosFiscalProfile = {
  orgName: string | null
  legalName: string | null
  cuit: string | null
  ivaCondition: string | null
  ivaConditionLabel: string | null
  fiscalAddress: string | null
  branchName: string | null
  branchAddress: string | null
  establishmentCode: string | null
  puntoVenta: string | null
  grossIncome: string | null
  activityStartDate: string | null
  consumerDefenseLine: string | null
  comprobanteCodigo: string | null
  loading: boolean
}

const EMPTY: PosFiscalProfile = {
  orgName: null,
  legalName: null,
  cuit: null,
  ivaCondition: null,
  ivaConditionLabel: null,
  fiscalAddress: null,
  branchName: null,
  branchAddress: null,
  establishmentCode: null,
  puntoVenta: null,
  grossIncome: null,
  activityStartDate: null,
  consumerDefenseLine: null,
  comprobanteCodigo: '083',
  loading: true,
}

export function usePosFiscalProfile(): PosFiscalProfile {
  const [profile, setProfile] = useState<PosFiscalProfile>(EMPTY)

  useEffect(() => {
    let cancelled = false

    function load() {
      void window.pos.settings.get().then((s) => {
        if (cancelled) return
        setProfile({
          orgName: s.org_name ?? null,
          legalName: s.org_legal_name ?? s.org_name ?? null,
          cuit: s.org_cuit ?? null,
          ivaCondition: s.org_iva_condition ?? null,
          ivaConditionLabel: ivaConditionLabel(s.org_iva_condition),
          fiscalAddress: s.org_fiscal_address ?? null,
          branchName: s.branch_name ?? null,
          branchAddress: s.branch_address ?? null,
          establishmentCode: s.branch_establishment || null,
          puntoVenta: s.branch_punto_venta || s.device_punto_venta || null,
          grossIncome: s.org_gross_income || null,
          activityStartDate: s.org_activity_start || null,
          consumerDefenseLine: s.org_consumer_defense || null,
          comprobanteCodigo: s.org_comprobante_codigo || '083',
          loading: false,
        })
      }).catch(() => {
        if (!cancelled) setProfile((prev) => ({ ...prev, loading: false }))
      })
    }

    load()
    window.addEventListener('focus', load)
    return () => {
      cancelled = true
      window.removeEventListener('focus', load)
    }
  }, [])

  return profile
}
