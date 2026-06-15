'use client'

import { useEffect, useState } from 'react'
import type { PrintableDocument } from '@/types/printing'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import { Button } from '@/components/primitives/Button'
import { PrintDocumentRenderer } from './PrintDocumentRenderer'

export interface PrintDocumentPageClientProps {
  domain: string
  resource: string
  id: string
}

export function PrintDocumentPageClient({ domain, resource, id }: PrintDocumentPageClientProps) {
  const [doc, setDoc] = useState<PrintableDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const body = await fetchJson<{ data?: PrintableDocument }>(
          `/api/v1/printing/${domain}/${resource}/${id}`,
        )
        if (cancelled) return
        setDoc(body.data ?? null)
      } catch (e) {
        if (cancelled) return
        setDoc(null)
        setError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [domain, resource, id])

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-hover p-6 print:hidden">
        <p className="text-sm text-fg-muted">Cargando…</p>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-hover p-6 print:hidden">
        <p className="text-sm text-danger">{error ?? 'Documento no disponible'}</p>
        <Button type="button" variant="secondary" onClick={() => window.close()}>
          Cerrar
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-hover py-6 print:bg-surface print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4 print:hidden">
        <Button type="button" variant="primary" onClick={handlePrint}>
          Imprimir / PDF
        </Button>
      </div>
      <div className="print-px-0">
        <PrintDocumentRenderer document={doc} />
      </div>
    </div>
  )
}
