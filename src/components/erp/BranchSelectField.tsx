'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FormField } from '@/components/primitives/FormField'
import { SearchableSelect } from './SearchableSelect'
import type { SearchableSelectOption } from './SearchableSelect'

export type BranchListItem = { id: string; name: string; branch_code: number }

export type BranchSelectOptionLabel = (b: BranchListItem) => string

const defaultLabel: BranchSelectOptionLabel = (b) =>
  `${String(b.branch_code).padStart(2, '0')} — ${b.name}`

interface BranchSelectFieldProps {
  value: string | null
  onChange: (branchId: string | null) => void
  disabled?: boolean
  error?: string
  id?: string
  label?: string
  placeholder?: string
  /** Endpoint that returns `{ data: BranchListItem[] }` */
  fetchUrl?: string
  optionLabel?: BranchSelectOptionLabel
  /**
   * If true, auto-selects:
   * - session.user.branchId when present in options
   * - otherwise the only option when there is exactly one
   */
  autoDefaultFromSession?: boolean
}

export function BranchSelectField({
  value,
  onChange,
  disabled,
  error,
  id = 'branch_id',
  label = 'Sucursal',
  placeholder = 'Seleccionar sucursal…',
  fetchUrl = '/api/v1/branches',
  optionLabel = defaultLabel,
  autoDefaultFromSession = true,
}: BranchSelectFieldProps) {
  const { data: session } = useSession()
  const [options, setOptions] = useState<SearchableSelectOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(fetchUrl)
      if (cancelled) return
      if (!res.ok) {
        setLoadError('No se pudieron cargar las sucursales.')
        return
      }
      const j = await res.json() as { data?: BranchListItem[] }
      const rows = Array.isArray(j.data) ? j.data : []
      const opts = rows.map(b => ({
        value: b.id,
        label: optionLabel(b),
      }))
      setOptions(opts)
      setLoadError(null)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchUrl, optionLabel])

  const applyDefault = useCallback(() => {
    if (!autoDefaultFromSession) return
    if (disabled || value !== null) return
    const pref = session?.user?.branchId ?? null
    if (pref && options.some(o => o.value === pref)) {
      onChange(pref)
      return
    }
    if (options.length === 1) onChange(options[0].value)
  }, [autoDefaultFromSession, disabled, value, session?.user?.branchId, options, onChange])

  useEffect(() => {
    if (options.length === 0) return
    applyDefault()
  }, [options, applyDefault])

  return (
    <FormField label={label} htmlFor={id} error={error ?? loadError ?? undefined}>
      <SearchableSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled || options.length === 0}
        clearable={false}
        error={!!error}
      />
    </FormField>
  )
}

