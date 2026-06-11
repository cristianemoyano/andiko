'use client'

import { BranchSelectField } from './BranchSelectField'

interface VentasBranchFieldProps {
  value: string | null
  onChange: (branchId: string | null) => void
  disabled?: boolean
  error?: string
  id?: string
}

export function VentasBranchField({
  value,
  onChange,
  disabled,
  error,
  id = 'branch_id',
}: VentasBranchFieldProps) {
  return <BranchSelectField id={id} value={value} onChange={onChange} disabled={disabled} error={error} />
}
