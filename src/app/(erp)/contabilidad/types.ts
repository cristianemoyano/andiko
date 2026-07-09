export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  asset:     'Activo',
  liability: 'Pasivo',
  equity:    'Patrimonio Neto',
  income:    'Ingresos',
  expense:   'Egresos',
}

export type Account = {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: keyof typeof ACCOUNT_TYPE_LABEL | string
  is_postable: boolean
  is_active: boolean
  is_system: boolean
}

export type JournalEntryListItem = {
  id: string
  entry_number: string
  entry_date: string
  description: string | null
  status: 'draft' | 'posted'
  total_debit: string
  total_credit: string
}

export type JournalEntryLine = {
  id: string
  account_id: string
  branch_id: string | null
  description: string | null
  debit: string
  credit: string
  sort_order: number
  account?: { id: string; code: string; name: string; type: string } | null
  branch?: { id: string; branch_code: number; name: string } | null
}

export type JournalEntry = JournalEntryListItem & {
  lines: JournalEntryLine[]
}

export type BranchOption = {
  id: string
  name: string
  branch_code: number
}

export const ENTRY_STATUS_LABEL: Record<string, string> = {
  draft:  'Borrador',
  posted: 'Contabilizado',
}
