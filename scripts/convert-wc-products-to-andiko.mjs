#!/usr/bin/env node
/**
 * Converts a WooCommerce product export CSV to Andiko catalog import format.
 * Usage: node scripts/convert-wc-products-to-andiko.mjs <input.csv> [output.csv]
 */

import fs from 'node:fs'
import path from 'node:path'

const ANDIKO_HEADERS = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Nombre' },
  { key: 'product_type', label: 'Tipo' },
  { key: 'status', label: 'Estado' },
  { key: 'category_name', label: 'Categoria' },
  { key: 'vendor', label: 'Proveedor' },
  { key: 'iva_rate', label: 'IVA' },
  { key: 'unit_of_measure', label: 'Unidad' },
  { key: 'base_price', label: 'Precio base' },
  { key: 'cost_price', label: 'Costo' },
  { key: 'barcode', label: 'Codigo de barras' },
  { key: 'manage_stock', label: 'Gestiona stock' },
  { key: 'stock_quantity', label: 'Stock' },
  { key: 'description', label: 'Descripcion' },
  { key: 'short_description', label: 'Descripcion corta' },
  { key: 'ncm_code', label: 'NCM' },
  { key: 'tags', label: 'Tags' },
  { key: 'catalog_external_id', label: 'ID en sistema origen (fila)' },
  { key: 'catalog_row_type', label: 'Tipo de fila (simple / variable / variation)' },
  { key: 'catalog_parent_id', label: 'ID padre en sistema origen' },
  { key: 'catalog_published', label: 'Publicado en origen (ej. 1 / 0 / -1)' },
  { key: 'sale_price', label: 'Precio oferta' },
  { key: 'images_urls', label: 'URLs de imagenes (separadas por coma)' },
  { key: 'catalog_position', label: 'Posicion (orden variante)' },
]

/** RFC-style CSV parser (supports quoted fields with embedded newlines). */
function parseCsvText(text) {
  const clean = text.startsWith('\uFEFF') ? text.slice(1) : text.replace(/^\uFEFF/, '')
  const normalized = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized.trim()) return { headers: [], rows: [] }

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += ch
    }
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)

  if (rows.length === 0) return { headers: [], rows: [] }

  const headers = rows[0]
  const dataRows = rows.slice(1).map((values) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? ''
    })
    return obj
  })
  return { headers, rows: dataRows }
}

function escapeCsv(v) {
  const s = v == null ? '' : String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvText(rows, headers) {
  const headerRow = headers.map((h) => escapeCsv(h.label)).join(',')
  const dataRows = rows.map((row) => headers.map((h) => escapeCsv(row[h.key] ?? '')).join(','))
  return [headerRow, ...dataRows].join('\r\n')
}

function normalizeDecimal(value) {
  const v = (value ?? '').trim()
  if (v === '') return ''
  return v.replace(',', '.')
}

function parseCategory(raw) {
  const first = (raw ?? '').split(',')[0]?.trim() ?? ''
  if (!first) return ''
  return first.replace(/^\d+\.\s*/, '').trim()
}

function publishedToStatus(raw) {
  const s = (raw ?? '').trim()
  if (s === '1') return 'active'
  if (s === '0') return 'draft'
  if (s === '-1') return 'archived'
  return ''
}

function parseManageStock(raw) {
  const s = (raw ?? '').trim().toLowerCase()
  if (s === '1' || s === 'yes' || s === 'si' || s === 'sí' || s === 'backorder') return 'true'
  if (s === '0' || s === 'no') return 'false'
  return ''
}

function parseStock(raw) {
  const s = (raw ?? '').trim()
  if (s === '') return ''
  const n = Number.parseInt(s, 10)
  if (Number.isNaN(n)) return ''
  return String(Math.max(0, n))
}

function sanitizeText(value) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function mapProductType(tipo) {
  const t = (tipo ?? '').trim().toLowerCase()
  if (t === 'simple' || t === 'service') return t
  if (
    t === 'variable' ||
    t === 'variation' ||
    t === 'grouped' ||
    t === 'external' ||
    t === 'bundle' ||
    t === 'virtual' ||
    t === 'downloadable'
  ) {
    return 'simple'
  }
  return 'simple'
}

function convertRow(wc) {
  const tipo = (wc.Tipo ?? '').trim().toLowerCase()
  const published = (wc.Publicado ?? '').trim()

  return {
    sku: (wc.SKU ?? '').trim(),
    name: (wc.Nombre ?? '').trim(),
    product_type: mapProductType(tipo),
    status: publishedToStatus(published),
    category_name: parseCategory(wc.Categorías),
    vendor: '',
    iva_rate: '21',
    unit_of_measure: 'unidad',
    base_price: normalizeDecimal(wc['Precio normal']),
    cost_price: '',
    barcode: (wc['GTIN, UPC, EAN o ISBN'] ?? '').trim(),
    manage_stock: parseManageStock(wc['¿Existencias?']),
    stock_quantity: parseStock(wc.Inventario),
    description: sanitizeText(wc.Descripción),
    short_description: sanitizeText(wc['Descripción corta']),
    ncm_code: '',
    tags: (wc.Etiquetas ?? '').trim(),
    catalog_external_id: (wc.ID ?? '').trim(),
    catalog_row_type: tipo,
    catalog_parent_id: (wc.Superior ?? '').trim(),
    catalog_published: published,
    sale_price: normalizeDecimal(wc['Precio rebajado']),
    images_urls: (wc.Imágenes ?? '').trim(),
    catalog_position: (wc.Posición ?? wc.Posicion ?? '').trim(),
  }
}

const inputPath = process.argv[2]
const outputPath =
  process.argv[3] ??
  path.join(
    path.dirname(inputPath ?? '.'),
    'andiko-products-import.csv',
  )

if (!inputPath) {
  console.error('Usage: node scripts/convert-wc-products-to-andiko.mjs <input.csv> [output.csv]')
  process.exit(1)
}

const text = fs.readFileSync(inputPath, 'utf8')
const { rows } = parseCsvText(text)
const converted = rows.map(convertRow).filter((r) => r.catalog_external_id)

const csv = toCsvText(converted, ANDIKO_HEADERS)
fs.writeFileSync(outputPath, csv, 'utf8')

const stats = converted.reduce(
  (acc, r) => {
    acc[r.catalog_row_type] = (acc[r.catalog_row_type] ?? 0) + 1
    return acc
  },
  {},
)

console.log(`Wrote ${converted.length} rows to ${outputPath}`)
console.log('Row types:', stats)
