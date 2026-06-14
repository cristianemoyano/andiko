'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DataTable, TablePagination, type Column } from '@/components/erp'
import { StatusBadge } from '@/components/primitives/Badge'
import { Button } from '@/components/primitives/Button'
import { Dialog } from '@/components/primitives/Dialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'

type EmailDocumentType = 'quote' | 'order' | 'invoice' | 'delivery_note'
type EmailLogStatus = 'sent' | 'failed'
type EmailLogTransport = 'smtp' | 'log'

interface EmailLogListItem {
  id: string
  recipient: string
  subject: string
  status: EmailLogStatus
  error: string | null
  sent_at: string
  document_type: EmailDocumentType
  document_id: string
  document_label: string
  document_number: string | null
  transport: EmailLogTransport | null
}

interface EmailLogDetail extends EmailLogListItem {
  body_text: string | null
  body_html: string | null
  message_id: string | null
  sent_by: string | null
}

const PAGE_SIZE = 20

const DOCUMENT_TYPE_LABEL: Record<EmailDocumentType, string> = {
  quote: 'Presupuesto',
  order: 'Pedido',
  invoice: 'Factura',
  delivery_note: 'Remito',
}

const DOCUMENT_HREF: Record<EmailDocumentType, (id: string) => string> = {
  quote: (id) => `/ventas/presupuestos/${id}`,
  order: (id) => `/ventas/pedidos/${id}`,
  invoice: (id) => `/ventas/facturas/${id}`,
  delivery_note: (id) => `/inventario/remitos/${id}`,
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function transportLabel(transport: EmailLogTransport | null): string {
  if (transport === 'smtp') return 'SMTP'
  if (transport === 'log') return 'Registrado'
  return '—'
}

function statusLabel(status: EmailLogStatus): string {
  return status === 'sent' ? 'Enviado' : 'Falló'
}

export function EmailLogsTab() {
  const [rows, setRows] = useState<EmailLogListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<EmailLogStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<EmailDocumentType | ''>('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<EmailLogDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter ? { document_type: typeFilter } : {}),
      })
      try {
        const data = await fetchJson<{ data: EmailLogListItem[]; total: number }>(
          `/api/v1/communications/logs?${params}`,
        )
        if (cancelled) return
        setRows(data.data)
        setTotal(data.total)
        const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
        setPage(p => (p > pages ? pages : p))
      } catch (e) {
        if (cancelled) return
        setServerError(getApiErrorMessage(e))
        setRows([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, search, statusFilter, typeFilter])

  async function openDetail(row: EmailLogListItem) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    try {
      const body = await fetchJson<{ log: EmailLogDetail }>(`/api/v1/communications/logs/${row.id}`)
      setDetail(body.log)
    } catch (e) {
      setDetailError(getApiErrorMessage(e))
    } finally {
      setDetailLoading(false)
    }
  }

  const columns: Column<EmailLogListItem>[] = [
    {
      key: 'sent_at',
      header: 'Fecha',
      sortable: true,
      render: row => (
        <span className="text-[12px] text-zinc-600 tabular-nums">{formatDateTime(row.sent_at)}</span>
      ),
    },
    {
      key: 'recipient',
      header: 'Destinatario',
      sortable: true,
      render: row => <span className="text-zinc-900">{row.recipient}</span>,
    },
    {
      key: 'subject',
      header: 'Asunto',
      render: row => (
        <span className="block max-w-[280px] truncate text-zinc-800" title={row.subject}>
          {row.subject}
        </span>
      ),
    },
    {
      key: 'document_type',
      header: 'Documento',
      render: row => (
        <span className="text-[12px] text-zinc-700">
          {row.document_label}
          {row.document_number ? ` · ${row.document_number}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: row => <StatusBadge value={statusLabel(row.status)} />,
    },
    {
      key: 'transport',
      header: 'Transporte',
      render: row => (
        <span className="text-[12px] text-zinc-600">{transportLabel(row.transport)}</span>
      ),
    },
    {
      key: 'error',
      header: 'Error',
      render: row =>
        row.error ? (
          <span className="block max-w-[180px] truncate text-[12px] text-red-600" title={row.error}>
            {row.error}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: '_actions',
      header: '',
      render: row => (
        <Button
          variant="ghost"
          size="xs"
          data-stop-row-click
          onClick={() => openDetail(row)}
        >
          Ver
        </Button>
      ),
    },
  ]

  return (
    <>
      {serverError ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {serverError}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Cargando…</p>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          keyExtractor={r => r.id}
          onRowClick={openDetail}
          emptyMessage="Todavía no hay emails enviados en esta organización."
          toolbar={
            <>
              <div className="relative flex items-center w-full sm:w-auto">
                <svg
                  className="absolute left-2 text-zinc-400 pointer-events-none"
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M10.5 10.5l3 3" />
                </svg>
                <input
                  className="pl-7 pr-3 h-[30px] text-[13px] border border-zinc-300 rounded-sm w-full sm:w-52 bg-white focus:outline-none focus:border-blue-500"
                  placeholder="Buscar destinatario o asunto…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </div>

              <select
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as EmailLogStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Todos los estados</option>
                <option value="sent">Enviado</option>
                <option value="failed">Falló</option>
              </select>

              <select
                className="h-[30px] text-[13px] border border-zinc-300 rounded-sm px-2 bg-white focus:outline-none focus:border-blue-500 text-zinc-700"
                value={typeFilter}
                onChange={e => {
                  setTypeFilter(e.target.value as EmailDocumentType | '')
                  setPage(1)
                }}
              >
                <option value="">Todos los documentos</option>
                {(Object.keys(DOCUMENT_TYPE_LABEL) as EmailDocumentType[]).map(type => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>

              <span className="flex-1" />
              <span className="text-[12px] text-zinc-500">
                {total} registro{total !== 1 ? 's' : ''}
              </span>
            </>
          }
          footer={
            total > 0 ? (
              <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            ) : undefined
          }
        />
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        size="lg"
        title="Detalle del email"
        description={detail ? formatDateTime(detail.sent_at) : undefined}
      >
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          {detailLoading ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : detailError ? (
            <p className="text-sm text-red-700">{detailError}</p>
          ) : detail ? (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <div>
                  <dt className="text-zinc-500">Destinatario</dt>
                  <dd className="text-zinc-900">{detail.recipient}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Estado</dt>
                  <dd>
                    <StatusBadge value={statusLabel(detail.status)} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-zinc-500">Asunto</dt>
                  <dd className="text-zinc-900">{detail.subject}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Documento</dt>
                  <dd>
                    <Link
                      href={DOCUMENT_HREF[detail.document_type](detail.document_id)}
                      className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    >
                      {detail.document_label}
                      {detail.document_number ? ` ${detail.document_number}` : ''}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Transporte</dt>
                  <dd className="text-zinc-900">{transportLabel(detail.transport)}</dd>
                </div>
                {detail.message_id ? (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">Message ID</dt>
                    <dd className="font-mono text-[12px] text-zinc-700 break-all">{detail.message_id}</dd>
                  </div>
                ) : null}
                {detail.error ? (
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-500">Error</dt>
                    <dd className="text-red-700">{detail.error}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="border-t border-zinc-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
                  Contenido
                </p>
                {detail.body_text ? (
                  <pre className="whitespace-pre-wrap rounded-sm border border-zinc-200 bg-zinc-50 p-3 text-[13px] text-zinc-800 font-sans leading-relaxed">
                    {detail.body_text}
                  </pre>
                ) : (
                  <p className="text-[13px] text-zinc-500">
                    Este envío fue registrado antes de guardar contenido.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
            Cerrar
          </Button>
        </div>
      </Dialog>
    </>
  )
}
