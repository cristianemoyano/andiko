'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { DataTable, type Column } from '@/components/erp'
import { Button } from '@/components/primitives/Button'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { CurrencyInput, formatARS } from '@/components/primitives/CurrencyInput'
import { DateInput } from '@/components/primitives/DateInput'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { CreditCardRow, CreditCardStatementRow } from '../../types'
import { CREDIT_CARD_CURRENCY_MODE_LABEL, EXPENSE_STATUS_LABEL } from '../../types'

function dateOnDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const clamped = Math.min(day, lastDay)
  return new Date(Date.UTC(year, monthIndex, clamped, 12, 0, 0))
}

function defaultPeriodLabel(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const STATEMENT_COLUMNS: Column<CreditCardStatementRow>[] = [
  {
    key: 'period_label',
    header: 'Período',
    render: row => <span className="font-medium text-fg">{row.period_label}</span>,
  },
  {
    key: 'closing_date',
    header: 'Cierre',
    render: row => new Date(row.closing_date).toLocaleDateString('es-AR'),
  },
  {
    key: 'due_date',
    header: 'Vencimiento',
    render: row => new Date(row.due_date).toLocaleDateString('es-AR'),
  },
  {
    key: 'amount_ars',
    header: 'ARS',
    render: row => <span className="tabular-nums">{formatARS(row.amount_ars)}</span>,
  },
  {
    key: 'amount_usd',
    header: 'USD',
    render: row => (
      <span className="tabular-nums text-fg-muted">
        {parseFloat(row.amount_usd) > 0 ? Number(row.amount_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '—'}
      </span>
    ),
  },
  {
    key: 'amount_ars_total',
    header: 'Total ARS',
    render: row => <span className="tabular-nums font-medium">{formatARS(row.amount_ars_total)}</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    // The linked expense is the payable — its status wins over the statement snapshot.
    render: row => {
      const status = row.expense?.status ?? row.status
      return EXPENSE_STATUS_LABEL[status] ?? status
    },
  },
]

export function TarjetaDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [card, setCard] = useState<CreditCardRow | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formKey, setFormKey] = useState(0)

  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel())
  const [closingDate, setClosingDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [amountArs, setAmountArs] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [fxRate, setFxRate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchJson<CreditCardRow>(`/api/v1/expenses/credit-cards/${id}`)
        if (!cancelled) {
          setCard(data)
          setError('')
          const now = new Date()
          setClosingDate(dateOnDay(now.getFullYear(), now.getMonth(), data.closing_day))
          setDueDate(dateOnDay(now.getFullYear(), now.getMonth(), data.due_day))
        }
      } catch (err) {
        if (!cancelled) {
          setCard(null)
          setError(getApiErrorMessage(err))
        }
      }
    })()
    return () => { cancelled = true }
  }, [id, refresh])

  const showUsd = card?.currency_mode === 'usd' || card?.currency_mode === 'ars_usd'
  const showArs = card?.currency_mode === 'ars' || card?.currency_mode === 'ars_usd'

  const previewTotal = useMemo(() => {
    const ars = parseFloat(amountArs) || 0
    const usd = parseFloat(amountUsd) || 0
    const fx = parseFloat(fxRate) || 0
    return ars + (usd > 0 && fx > 0 ? usd * fx : 0)
  }, [amountArs, amountUsd, fxRate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!card || !closingDate || !dueDate || !periodLabel.trim()) {
      setFormError('Completá período, cierre y vencimiento.')
      return
    }
    setSaving(true)
    try {
      const statement = await fetchJson<CreditCardStatementRow>('/api/v1/expenses/credit-card-statements', {
        method: 'POST',
        body: JSON.stringify({
          credit_card_id: card.id,
          period_label: periodLabel.trim(),
          closing_date: closingDate.toISOString(),
          due_date: dueDate.toISOString(),
          amount_ars: showArs ? Number(amountArs || 0) : 0,
          amount_usd: showUsd ? Number(amountUsd || 0) : 0,
          fx_rate: showUsd && amountUsd ? Number(fxRate) : null,
          notes: notes.trim() || null,
        }),
      })
      setFormKey(k => k + 1)
      setAmountArs('')
      setAmountUsd('')
      setFxRate('')
      setNotes('')
      setPeriodLabel(defaultPeriodLabel())
      setRefresh(r => r + 1)
      if (statement.expense_id) {
        router.push(`/expensas/${statement.expense_id}`)
        return
      }
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (error && !card) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Tarjetas', href: '/expensas/tarjetas' }, { label: 'Error' }]} />
        <PageBody><p className="text-sm text-danger">{error}</p></PageBody>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="flex flex-col h-full">
        <TopBar breadcrumbs={[{ label: 'Expensas', href: '/expensas' }, { label: 'Tarjetas', href: '/expensas/tarjetas' }, { label: '…' }]} />
        <PageBody><p className="text-sm text-fg-muted">Cargando…</p></PageBody>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Expensas', href: '/expensas' },
          { label: 'Tarjetas', href: '/expensas/tarjetas' },
          { label: card.name },
        ]}
      />
      <PageBody className="flex flex-col gap-6">
        <div className="bg-surface border border-border rounded-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-fg">{card.name}</h1>
              <p className="text-[13px] text-fg-muted mt-1">
                {card.contact?.legal_name ?? 'Sin emisor'}
                {card.last_four ? ` · ····${card.last_four}` : ''}
                {' · '}
                {CREDIT_CARD_CURRENCY_MODE_LABEL[card.currency_mode]}
                {' · '}
                Cierre día {card.closing_day} / Vto día {card.due_day}
              </p>
              <p className="text-[12px] text-fg-subtle mt-1">
                Cuenta {card.expense_account_code}
              </p>
            </div>
            {!card.is_active && (
              <span className="text-[12px] text-fg-subtle">Inactiva</span>
            )}
          </div>
        </div>

        <form
          key={formKey}
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-sm p-5 flex flex-col gap-4"
        >
          <div>
            <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide">
              Cargar resumen del mes
            </p>
            <p className="text-[12px] text-fg-muted mt-0.5">
              El monto puede variar cada período. Se crea un gasto confirmado para pagar.
            </p>
          </div>
          {formError && <p className="text-sm text-danger">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <FormField label="Período" required>
              <Input
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                placeholder="2026-07"
              />
            </FormField>
            <FormField label="Cierre" required>
              <DateInput value={closingDate} onChange={setClosingDate} />
            </FormField>
            <FormField label="Vencimiento" required>
              <DateInput value={dueDate} onChange={setDueDate} />
            </FormField>
            {showArs && (
              <FormField label="Monto ARS" required={!showUsd}>
                <CurrencyInput value={amountArs} onChange={setAmountArs} />
              </FormField>
            )}
            {showUsd && (
              <>
                <FormField label="Monto USD" required={!showArs}>
                  <CurrencyInput value={amountUsd} onChange={setAmountUsd} />
                </FormField>
                <FormField label="Cotización USD→ARS" required>
                  <CurrencyInput value={fxRate} onChange={setFxRate} />
                </FormField>
              </>
            )}
            <FormField label="Notas" className="sm:col-span-2 lg:col-span-3">
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
            </FormField>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-fg-muted">
              Total a pagar:{' '}
              <span className="font-medium text-fg tabular-nums">{formatARS(previewTotal)}</span>
            </p>
            <Button type="submit" disabled={saving || !card.is_active}>
              {saving ? 'Guardando…' : 'Confirmar resumen'}
            </Button>
          </div>
        </form>

        <div>
          <p className="text-[11px] text-fg-subtle font-semibold uppercase tracking-wide mb-3">
            Últimos resúmenes
          </p>
          <DataTable
            columns={STATEMENT_COLUMNS}
            data={card.statements ?? []}
            keyExtractor={row => row.id}
            onRowClick={row => {
              if (row.expense_id) router.push(`/expensas/${row.expense_id}`)
            }}
            emptyMessage="Todavía no hay resúmenes cargados"
          />
        </div>
      </PageBody>
    </div>
  )
}
