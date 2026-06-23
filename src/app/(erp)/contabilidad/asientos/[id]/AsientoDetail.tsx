'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { formatARS } from '@/components/primitives/CurrencyInput'
import { ConfirmDialog } from '@/components/erp/ConfirmDialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { notifyApiError, notifySuccess } from '@/lib/notify'
import { ContabilidadSubNav } from '../../ContabilidadSubNav'
import { AsientoModal } from '../AsientoModal'
import { ENTRY_STATUS_LABEL, type JournalEntry } from '../../types'

function formatDate(value: string): string {
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

export function AsientoDetail({ id }: { id: string }) {
  const router = useRouter()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoadError(null)
      try {
        const data = await fetchJson<JournalEntry>(`/api/v1/accounting/journal-entries/${id}`)
        if (!mounted) return
        setEntry(data)
      } catch (e) {
        if (!mounted) return
        setLoadError(getApiErrorMessage(e))
      }
    })()
    return () => { mounted = false }
  }, [id, refresh])

  async function handlePost() {
    setPosting(true)
    try {
      await fetchJson(`/api/v1/accounting/journal-entries/${id}/post`, { method: 'POST' })
      notifySuccess('Asiento contabilizado')
      setRefresh(r => r + 1)
    } catch (e) {
      notifyApiError(e)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete() {
    try {
      await fetchJson(`/api/v1/accounting/journal-entries/${id}`, { method: 'DELETE' })
      setConfirmDelete(false)
      notifySuccess('Asiento eliminado')
      router.push('/contabilidad/asientos')
    } catch (e) {
      notifyApiError(e)
    }
  }

  const isDraft = entry?.status === 'draft'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[
          { label: 'Contabilidad', href: '/contabilidad/asientos' },
          { label: 'Asientos', href: '/contabilidad/asientos' },
          { label: entry?.entry_number ?? '…' },
        ]}
        actions={
          isDraft ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>Editar</Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(true)}>Eliminar</Button>
              <Button size="sm" onClick={handlePost} disabled={posting}>{posting ? 'Contabilizando…' : 'Contabilizar'}</Button>
            </div>
          ) : undefined
        }
      />
      <ContabilidadSubNav />

      <PageBody>
        {loadError && (
          <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger">{loadError}</div>
        )}

        {entry && (
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-3">
                <h1 className="text-[16px] font-semibold text-fg font-mono">{entry.entry_number}</h1>
                <span className="text-[13px] text-fg-muted">{formatDate(entry.entry_date)}</span>
              </div>
              <StatusBadge value={ENTRY_STATUS_LABEL[entry.status] ?? entry.status} />
            </div>

            {entry.description && (
              <p className="text-[13px] text-fg-muted mb-4">{entry.description}</p>
            )}

            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-muted text-fg-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Cuenta</th>
                    <th className="text-left font-medium px-3 py-2">Sucursal</th>
                    <th className="text-left font-medium px-3 py-2">Detalle</th>
                    <th className="text-right font-medium px-3 py-2">Debe</th>
                    <th className="text-right font-medium px-3 py-2">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.lines.map(line => (
                    <tr key={line.id} className="border-t border-border">
                      <td className="px-3 py-2 text-fg">
                        {line.account ? <><span className="font-mono text-[12px] text-fg-muted">{line.account.code}</span> {line.account.name}</> : '—'}
                      </td>
                      <td className="px-3 py-2 text-fg-muted text-[12px]">
                        {line.branch ? `${String(line.branch.branch_code).padStart(2, '0')} — ${line.branch.name}` : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className="px-3 py-2 text-fg-muted text-[12px]">{line.description ?? <span className="text-fg-subtle">—</span>}</td>
                      <td className="px-3 py-2 text-right font-mono text-fg">{parseFloat(line.debit) > 0 ? formatARS(line.debit) : ''}</td>
                      <td className="px-3 py-2 text-right font-mono text-fg">{parseFloat(line.credit) > 0 ? formatARS(line.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface-muted border-t border-border font-medium">
                  <tr>
                    <td className="px-3 py-2 text-fg-muted" colSpan={3}>Totales</td>
                    <td className="px-3 py-2 text-right font-mono text-fg">{formatARS(entry.total_debit)}</td>
                    <td className="px-3 py-2 text-right font-mono text-fg">{formatARS(entry.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </PageBody>

      {entry && (
        <AsientoModal
          open={editOpen}
          entry={entry}
          onOpenChange={setEditOpen}
          onSaved={() => { setEditOpen(false); setRefresh(r => r + 1) }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar asiento"
        description={entry ? `Se eliminará el asiento ${entry.entry_number}.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
