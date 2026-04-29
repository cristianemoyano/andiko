'use client'

import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'

type LabelData = {
  name: string
  variantName: string
  sku: string
  barcode: string
  price: string
  copies: number
}

const formatArs = (v: string) => {
  const n = Number(v)
  if (isNaN(n)) return v
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n)
}

function Barcodesvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        width: 1.5,
        height: 28,
      })
    } catch {
      // invalid barcode value — skip
    }
  }, [value])

  if (!value) return null
  return <svg ref={ref} className="w-full" />
}

interface Props {
  storageKey: string
  size: 'small' | 'large'
}

export function EtiquetasPrintClient({ storageKey, size }: Props) {
  const [labels, setLabels] = useState<LabelData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (!storageKey) { setError('Clave de sesión inválida'); return }
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) { setError('Los datos de etiquetas expiraron. Volvé a imprimir desde el catálogo.'); return }
      try {
        setLabels(JSON.parse(raw) as LabelData[])
      } catch {
        setError('Error al leer los datos de etiquetas.')
      }
    })()
  }, [storageKey])

  useEffect(() => {
    if (labels.length === 0) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [labels])

  const isLarge = size === 'large'

  const expanded = labels.flatMap((l, li) =>
    Array.from({ length: Math.max(1, l.copies) }, (_, i) => ({ ...l, _key: `${li}-${i}` }))
  )

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 px-4 py-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Imprimir / PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Cerrar
        </button>
      </div>

      {error && (
        <p className="px-4 text-sm text-red-600 print:hidden">{error}</p>
      )}

      {!error && expanded.length === 0 && (
        <p className="px-4 text-sm text-zinc-500 print:hidden">Cargando etiquetas…</p>
      )}

      <div className="flex flex-wrap gap-2 p-4 print:gap-[2mm] print:p-[4mm]">
        {expanded.map((label) => (
          <div
            key={label._key}
            className="border border-zinc-300 bg-white flex flex-col overflow-hidden"
            style={{
              width: isLarge ? '10cm' : '5cm',
              height: isLarge ? '5cm' : '3cm',
              padding: isLarge ? '5px 7px' : '3px 5px',
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
              gap: '1px',
            }}
          >
            {/* Nombre */}
            <div
              className="font-semibold leading-tight text-zinc-900 overflow-hidden"
              style={{
                fontSize: isLarge ? '11px' : '8px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              } as React.CSSProperties}
            >
              {label.name}
              {label.variantName && (
                <span className="font-normal text-zinc-500"> — {label.variantName}</span>
              )}
            </div>

            {/* SKU */}
            {label.sku && (
              <div className="text-zinc-400" style={{ fontSize: isLarge ? '8px' : '6px' }}>
                {label.sku}
              </div>
            )}

            {/* Precio */}
            <div
              className="font-bold text-zinc-900"
              style={{ fontSize: isLarge ? '20px' : '13px', lineHeight: 1 }}
            >
              {label.price ? formatArs(label.price) : '—'}
            </div>

            {/* Barcode visual */}
            {label.barcode && (
              <div className="mt-auto" style={{ maxHeight: isLarge ? '36px' : '24px', overflow: 'hidden' }}>
                <Barcodesvg value={label.barcode} />
              </div>
            )}

            {/* Barcode número */}
            {label.barcode && (
              <div className="text-center text-zinc-500 font-mono" style={{ fontSize: '6px' }}>
                {label.barcode}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
