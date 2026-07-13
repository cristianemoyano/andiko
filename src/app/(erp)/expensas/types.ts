export type ExpenseStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'cancelled'
export type RecurringExpenseFrequency = 'monthly' | 'weekly'
export type PaymentMethod = 'transfer' | 'check' | 'cash' | 'credit_card' | 'debit_card' | 'other'

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft:           'Borrador',
  received:        'Recibido',
  partially_paid:  'Pago parcial',
  paid:            'Pagado',
  cancelled:       'Cancelado',
}

export const RECURRING_FREQUENCY_LABEL: Record<RecurringExpenseFrequency, string> = {
  monthly: 'Mensual',
  weekly:  'Semanal',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  transfer:    'Transferencia',
  check:       'Cheque',
  cash:        'Efectivo',
  credit_card: 'Tarjeta crédito',
  debit_card:  'Tarjeta débito',
  other:       'Otro',
}

export type Branch = { id: string; name: string; branch_code: number }
export type ContactSummary = { id: string; legal_name: string; trade_name: string | null }

export type ExpensePayment = {
  id: string
  payment_number: string
  expense_id: string
  amount: string
  payment_date: string
  payment_method: string
  notes: string | null
  created_at: string
  buyer?: { id: string; name: string }
}

export type Expense = {
  id: string
  expense_number: string
  invoice_number: string | null
  status: ExpenseStatus
  contact_id: string | null
  branch_id: string | null
  recurring_template_id: string | null
  description: string
  expense_account_code: string
  invoice_date: string | null
  due_date: string | null
  currency: string
  subtotal: string
  discount_amount: string
  tax_amount: string
  total: string
  paid_amount: string
  balance: string
  notes: string | null
  created_at: string
  branch: Branch | null
  contact: ContactSummary | null
  buyer?: { id: string; name: string }
  payments: ExpensePayment[]
}

export type RecurringExpenseTemplate = {
  id: string
  branch_id: string
  contact_id: string
  description: string
  expense_account_code: string
  default_amount: string
  iva_rate: string
  frequency: RecurringExpenseFrequency
  next_run_date: string
  is_active: boolean
  created_at: string
  branch: Branch | null
  contact: ContactSummary | null
}
