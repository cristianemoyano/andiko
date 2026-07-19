'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { BranchSelectField, DataTable, type Column, SearchableSelect, type SearchableSelectOption } from '@/components/erp'
import { SupplierQuickCreateDialog } from '@/components/erp/SupplierQuickCreateDialog'
import { Button } from '@/components/primitives/Button'
import { Dialog } from '@/components/primitives/Dialog'
import { FormField } from '@/components/primitives/FormField'
import { Input } from '@/components/primitives/Input'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { CreditCardRow } from '../types'
import { CREDIT_CARD_CURRENCY_MODE_LABEL } from '../types'

const COLUMNS: Column<CreditCardRow>[] = [
  {
    key: 'name',
    header: 'Tarjeta',
    render: row => (
      <div className="flex flex-col">
        <span className="font-medium text-fg">{row.name}</span>
        {row.last_four && (
          <span className="text-[12px] text-fg-muted font-mono">····{row.last_four}</span>
        )}
      </div>
    ),
  },
  {
    key: 'contact',
    header: 'Emisor / proveedor',
    render: row => row.contact?.legal_name ?? <span className="text-fg-subtle">—</span>,
  },
  {
    key: 'currency_mode',
    header: 'Monedas',
    render: row => CREDIT_CARD_CURRENCY_MODE_LABEL[row.currency_mode] ?? row.currency_mode,
  },
  {
    key: 'closing_day',
    header: 'Cierre / Vto',
    render: row => (
      <span className="tabular-nums text-fg-muted">
        día {row.closing_day} / día {row.due_day}
      </span>
    ),
  },
  {
    key: 'is_active',
    header: 'Estado',
    render: row => (
      <span className={row.is_active ? 'text-fg-muted' : 'text-fg-subtle'}>
        {row.is_active ? 'Activa' : 'Inactiva'}
      </span>
    ),
  },
]

type AccountOption = { code: string; name: string }

export function TarjetasClient() {
  const router = useRouter()
  const [cards, setCards] = useState<CreditCardRow[] | null>(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formKey, setFormKey] = useState(0)
  const [createSupplierOpen, setCreateSupplierOpen] = useState(false)
  const [createSupplierSeed, setCreateSupplierSeed] = useState('')

  const [branchId, setBranchId] = useState<string | null>(null)
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactOpts, setContactOpts] = useState<SearchableSelectOption[]>([])
  const [name, setName] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [currencyMode, setCurrencyMode] = useState<'ars' | 'usd' | 'ars_usd'>('ars')
  const [closingDay, setClosingDay] = useState('10')
  const [dueDay, setDueDay] = useState('20')
  const [accountCode, setAccountCode] = useState('')
  const [accountOpts, setAccountOpts] = useState<AccountOption[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await fetchJson<{ data: CreditCardRow[] }>(
          '/api/v1/expenses/credit-cards?limit=100',
        )
        if (!cancelled) {
          setCards(data.data ?? [])
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setCards([])
          setError(getApiErrorMessage(err))
        }
      }
    })()
    return () => { cancelled = true }
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchJson<{ data: AccountOption[] }>(
          '/api/v1/accounting/accounts?type=expense&all=true&is_postable=true',
        )
        if (!cancelled) setAccountOpts(d.data ?? [])
      } catch {
        /* ignore */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const searchSuppliers = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    try {
      const data = await fetchJson<{ data: Array<{ id: string; legal_name: string; trade_name: string | null }> }>(
        `/api/v1/contacts?search=${encodeURIComponent(q)}&limit=20&type=supplier`,
      )
      const opts = (data.data ?? []).map(c => ({
        value: c.id,
        label: c.legal_name,
        sublabel: c.trade_name ?? undefined,
      }))
      setContactOpts(opts)
      return opts
    } catch {
      return []
    }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!branchId || !contactId || !name.trim() || !accountCode) {
      setFormError('Completá sucursal, emisor, nombre y cuenta de gasto.')
      return
    }
    const closing = parseInt(closingDay, 10)
    const due = parseInt(dueDay, 10)
    if (!closing || closing < 1 || closing > 31 || !due || due < 1 || due > 31) {
      setFormError('Días de cierre y vencimiento deben estar entre 1 y 31.')
      return
    }
    setSaving(true)
    try {
      await fetchJson('/api/v1/expenses/credit-cards', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: branchId,
          contact_id: contactId,
          name: name.trim(),
          last_four: lastFour.trim() || null,
          currency_mode: currencyMode,
          closing_day: closing,
          due_day: due,
          expense_account_code: accountCode,
          is_active: true,
        }),
      })
      setCreateOpen(false)
      setFormKey(k => k + 1)
      setName('')
      setLastFour('')
      setContactId('')
      setRefresh(r => r + 1)
    } catch (err) {
      setFormError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Expensas', href: '/expensas' },
          { label: 'Tarjetas' },
        ]}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Nueva tarjeta
          </Button>
        }
      />

      <PageBody>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <p className="mb-4 text-[13px] text-fg-muted max-w-2xl">
          Registrá cada resumen mensual con el monto del período (ARS y/o USD). Se genera un gasto
          confirmado para pagar; el valor puede variar mes a mes.
        </p>
        <DataTable
          columns={COLUMNS}
          data={cards}
          keyExtractor={row => row.id}
          onRowClick={row => router.push(`/expensas/tarjetas/${row.id}`)}
          emptyMessage="No hay tarjetas cargadas"
        />
      </PageBody>

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nueva tarjeta"
        description="Emisor, días de cierre/vencimiento y cuenta contable por defecto."
        size="lg"
      >
        <form key={formKey} onSubmit={handleCreate} className="flex flex-col gap-4">
          {formError && (
            <p className="text-sm text-danger">{formError}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BranchSelectField value={branchId} onChange={setBranchId} required />
            <FormField label="Emisor / proveedor" required>
              <SearchableSelect
                value={contactId}
                onChange={setContactId}
                onSearch={searchSuppliers}
                options={contactOpts.length > 0 ? contactOpts : undefined}
                placeholder="Banco o emisor…"
                createActionLabel="Crear proveedor…"
                onCreateRequest={(query) => {
                  setCreateSupplierSeed(query)
                  setCreateSupplierOpen(true)
                }}
              />
            </FormField>
            <FormField label="Nombre" required>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Visa empresa" />
            </FormField>
            <FormField label="Últimos 4">
              <Input
                value={lastFour}
                onChange={e => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                inputMode="numeric"
              />
            </FormField>
            <FormField label="Monedas" required>
              <select
                value={currencyMode}
                onChange={e => setCurrencyMode(e.target.value as typeof currencyMode)}
                className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface"
              >
                <option value="ars">Solo ARS</option>
                <option value="usd">Solo USD</option>
                <option value="ars_usd">ARS + USD</option>
              </select>
            </FormField>
            <FormField label="Cuenta de gasto" required>
              <select
                value={accountCode}
                onChange={e => setAccountCode(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-border rounded-md bg-surface"
              >
                <option value="">Elegí una cuenta…</option>
                {accountOpts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Día de cierre" required>
              <Input value={closingDay} onChange={e => setClosingDay(e.target.value)} inputMode="numeric" />
            </FormField>
            <FormField label="Día de vencimiento" required>
              <Input value={dueDay} onChange={e => setDueDay(e.target.value)} inputMode="numeric" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear tarjeta'}
            </Button>
          </div>
        </form>
      </Dialog>

      <SupplierQuickCreateDialog
        open={createSupplierOpen}
        onOpenChange={setCreateSupplierOpen}
        initialLegalName={createSupplierSeed}
        onCreated={(option) => {
          setContactOpts(prev => {
            if (prev.some(o => o.value === option.value)) return prev
            return [option, ...prev]
          })
          setContactId(option.value)
        }}
      />
    </div>
  )
}
