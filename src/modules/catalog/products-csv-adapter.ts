import type { CsvHeader } from '@/lib/csv'
import type { ProductInput, ProductUpdateInput } from './product.schema'
import type { ProductStatus } from './product.model'

/** Destinos internos permitidos para import (allowlist) y tabla catalog_import_field_maps */
export const PRODUCT_IMPORT_META_HEADERS: CsvHeader[] = [
  { key: 'catalog_external_id', label: 'ID en sistema origen (fila)' },
  { key: 'catalog_row_type', label: 'Tipo de fila (simple / variable / variation)' },
  { key: 'catalog_parent_id', label: 'ID padre en sistema origen' },
  { key: 'catalog_published', label: 'Publicado en origen (ej. 1 / 0 / -1)' },
  { key: 'sale_price', label: 'Precio oferta' },
  { key: 'images_urls', label: 'URLs de imagenes (separadas por coma)' },
  { key: 'catalog_position', label: 'Posicion (orden variante)' },
]

export const PRODUCT_CSV_HEADERS: CsvHeader[] = [
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
]

/** Headers mostrados en ImportModal: campos de producto + metadatos jerárquicos */
export const PRODUCT_CSV_HEADERS_FOR_IMPORT: CsvHeader[] = [
  ...PRODUCT_CSV_HEADERS,
  ...PRODUCT_IMPORT_META_HEADERS,
]

const INTERNAL_KEYS = new Set(PRODUCT_CSV_HEADERS_FOR_IMPORT.map((h) => h.key))

export function isValidProductImportInternalKey(key: string): boolean {
  return INTERNAL_KEYS.has(key)
}

/**
 * Completa la fila mapeada con valores por defecto solo cuando la celda correspondiente
 * está vacía (útil para CSVs de terceros sin normalizar todo el formato).
 */
export function applyRowImportDefaults(
  mapped: Record<string, string>,
  defaults: Record<string, string>,
): Record<string, string> {
  if (!defaults || Object.keys(defaults).length === 0) return mapped
  const out: Record<string, string> = { ...mapped }
  for (const [key, raw] of Object.entries(defaults)) {
    if (!isValidProductImportInternalKey(key)) continue
    const val = (raw ?? '').trim()
    if (val === '') continue
    if ((out[key] ?? '').trim() === '') out[key] = val
  }
  return out
}

const IMPORT_DEFAULT_VALUE_MAX_LEN = 2048

/** Normaliza el JSON enviado desde el cliente (solo claves allowlist, valores string acotados). */
export function sanitizeImportDefaultsFromClient(raw: unknown): Record<string, string> {
  if (raw == null || raw === '') return {}
  let parsed: unknown
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return {}
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isValidProductImportInternalKey(k)) continue
    if (v == null) continue
    const s = String(v).trim().slice(0, IMPORT_DEFAULT_VALUE_MAX_LEN)
    if (s !== '') out[k] = s
  }
  return out
}

/**
 * Tipo de fila para import jerárquico: explícito (catalog_row_type) o inferido desde
 * product_type cuando el CSV de WooCommerce mapea "Tipo" solo a product_type.
 */
export function importRowCatalogKind(mapped: Record<string, string>): string {
  const direct = (mapped.catalog_row_type ?? '').trim().toLowerCase()
  if (direct === 'variable' || direct === 'variation') return direct
  const pt = (mapped.product_type ?? '').trim().toLowerCase()
  if (pt === 'variable' || pt === 'variation') return pt
  if (direct === 'simple') return 'simple'
  if (
    pt === 'simple' ||
    pt === 'grouped' ||
    pt === 'external' ||
    pt === 'bundle' ||
    pt === 'virtual' ||
    pt === 'downloadable'
  ) {
    return 'simple'
  }
  if (pt === 'service') return 'simple'
  return direct
}

/** WooCommerce/Shopify/etc. → Andiko (solo simple | service; lo demás se omite o es simple). */
export function mapCsvProductTypeToAndiko(rawLowercased: string): string {
  if (rawLowercased === '' || rawLowercased === 'service') return rawLowercased
  if (
    rawLowercased === 'simple' ||
    rawLowercased === 'variable' ||
    rawLowercased === 'variation' ||
    rawLowercased === 'grouped' ||
    rawLowercased === 'external' ||
    rawLowercased === 'bundle' ||
    rawLowercased === 'virtual' ||
    rawLowercased === 'downloadable'
  ) {
    return 'simple'
  }
  return ''
}

export function usesHierarchicalProductImport(mappedRows: Record<string, string>[]): boolean {
  for (const row of mappedRows) {
    const kind = importRowCatalogKind(row)
    if (kind === 'variable' || kind === 'variation') return true
  }
  let withMeta = 0
  for (const row of mappedRows) {
    const ext = (row.catalog_external_id ?? '').trim()
    const typ = (row.catalog_row_type ?? '').trim()
    if (ext && typ) withMeta++
  }
  return withMeta > 0 && withMeta >= Math.ceil(mappedRows.length * 0.5)
}

export function catalogPublishedToStatus(raw: string): ProductStatus | undefined {
  const s = raw.trim()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'si' || s === 'sí') return 'active'
  if (s === '0' || s === 'false' || s === 'no') return 'draft'
  if (s === '-1') return 'archived'
  return undefined
}

/** Precio variante: oferta si numérico, si no lista */
export function effectiveVariantBasePrice(basePrice: string, salePrice: string): string {
  const sale = normalizeDecimal(salePrice.trim())
  const base = normalizeDecimal(basePrice.trim())
  if (sale !== '' && /^\d+(\.\d{1,2})?$/.test(sale)) return sale
  return base
}

export type ProductCsvRow = {
  sku: string
  name: string
  product_type: string
  status: string
  category_name: string
  vendor: string
  iva_rate: string
  unit_of_measure: string
  base_price: string
  cost_price: string
  barcode: string
  manage_stock: string
  stock_quantity: string
  description: string
  short_description: string
  ncm_code: string
  tags: string
}

type ExportSource = {
  name: string
  product_type: string
  status: string
  vendor: string | null
  iva_rate: string
  unit_of_measure: string
  description: string | null
  short_description: string | null
  ncm_code: string | null
  tags: string[]
  category?: { name?: string | null } | null
  variants?: Array<{
    sku?: string | null
    base_price?: string | null
    cost_price?: string | null
    barcode?: string | null
    manage_stock?: boolean
    stock_quantity?: number
    is_default?: boolean
  }>
}

export function productToRow(product: ExportSource): ProductCsvRow {
  const defaultVariant = product.variants?.find((v) => v.is_default) ?? product.variants?.[0]
  return {
    sku: defaultVariant?.sku ?? '',
    name: product.name,
    product_type: product.product_type,
    status: product.status,
    category_name: product.category?.name ?? '',
    vendor: product.vendor ?? '',
    iva_rate: product.iva_rate,
    unit_of_measure: product.unit_of_measure,
    base_price: defaultVariant?.base_price ?? '',
    cost_price: defaultVariant?.cost_price ?? '',
    barcode: defaultVariant?.barcode ?? '',
    manage_stock: defaultVariant ? String(Boolean(defaultVariant.manage_stock)) : '',
    stock_quantity: defaultVariant?.stock_quantity != null ? String(defaultVariant.stock_quantity) : '',
    description: product.description ?? '',
    short_description: product.short_description ?? '',
    ncm_code: product.ncm_code ?? '',
    tags: product.tags.join(','),
  }
}

/** Construye fila normalizada solo con claves de producto; aplica publicado origen y precio oferta. */
export function mappedRowToNormalizedProductRow(row: Record<string, string>): ProductCsvRow {
  const slice: Record<string, string> = {}
  for (const h of PRODUCT_CSV_HEADERS) {
    slice[h.key] = row[h.key] ?? ''
  }
  const pub = catalogPublishedToStatus(row.catalog_published ?? '')
  if (pub && !slice.status.trim()) slice.status = pub
  const price = effectiveVariantBasePrice(slice.base_price, row.sale_price ?? '')
  if (price !== '') slice.base_price = price
  return normalizeProductImportRow(slice)
}

export function normalizeProductImportRow(row: Record<string, string>): ProductCsvRow {
  const ptRaw = (row.product_type ?? '').trim().toLowerCase()
  return {
    sku: (row.sku ?? '').trim(),
    name: (row.name ?? '').trim(),
    product_type: mapCsvProductTypeToAndiko(ptRaw),
    status: (row.status ?? '').trim().toLowerCase(),
    category_name: (row.category_name ?? '').trim(),
    vendor: (row.vendor ?? '').trim(),
    iva_rate: normalizeDecimal((row.iva_rate ?? '').trim()),
    unit_of_measure: (row.unit_of_measure ?? '').trim().toLowerCase(),
    base_price: normalizeDecimal((row.base_price ?? '').trim()),
    cost_price: normalizeDecimal((row.cost_price ?? '').trim()),
    barcode: (row.barcode ?? '').trim(),
    manage_stock: (row.manage_stock ?? '').trim().toLowerCase(),
    stock_quantity: (row.stock_quantity ?? '').trim(),
    description: (row.description ?? '').trim(),
    short_description: (row.short_description ?? '').trim(),
    ncm_code: (row.ncm_code ?? '').trim(),
    tags: (row.tags ?? '').trim(),
  }
}

export function rowToProductInput(
  row: ProductCsvRow,
  categoryId: string | undefined,
): ProductInput {
  return {
    sku: row.sku,
    name: row.name,
    product_type: emptyToUndefined(row.product_type),
    status: emptyToUndefined(row.status),
    category_id: categoryId,
    vendor: emptyToNull(row.vendor),
    iva_rate: emptyToUndefined(row.iva_rate),
    unit_of_measure: emptyToUndefined(row.unit_of_measure),
    base_price: emptyToNull(row.base_price),
    cost_price: emptyToNull(row.cost_price),
    barcode: emptyToNull(row.barcode),
    manage_stock: parseBoolean(row.manage_stock),
    stock_quantity: parseInteger(row.stock_quantity),
    description: emptyToNull(row.description),
    short_description: emptyToNull(row.short_description),
    ncm_code: emptyToNull(row.ncm_code),
    tags: parseTags(row.tags),
  } as ProductInput
}

export function rowToProductUpdateInput(
  row: ProductCsvRow,
  categoryId: string | undefined,
): ProductUpdateInput {
  return {
    sku: row.sku || undefined,
    name: emptyToUndefined(row.name),
    product_type: emptyToUndefined(row.product_type),
    status: emptyToUndefined(row.status),
    category_id: categoryId,
    vendor: emptyToNull(row.vendor),
    iva_rate: emptyToUndefined(row.iva_rate),
    unit_of_measure: emptyToUndefined(row.unit_of_measure),
    base_price: emptyToNull(row.base_price),
    cost_price: emptyToNull(row.cost_price),
    barcode: emptyToNull(row.barcode),
    manage_stock: parseBoolean(row.manage_stock),
    stock_quantity: parseInteger(row.stock_quantity),
    description: emptyToNull(row.description),
    short_description: emptyToNull(row.short_description),
    ncm_code: emptyToNull(row.ncm_code),
    tags: parseTags(row.tags),
  } as ProductUpdateInput
}

function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value
}

function emptyToNull(value: string): string | null | undefined {
  if (value === '') return undefined
  return value
}

export function normalizeDecimal(value: string): string {
  if (value === '') return value
  return value.replace(',', '.')
}

function parseBoolean(value: string): boolean | undefined {
  if (value === '') return undefined
  if (['true', '1', 'si', 'sí', 'yes'].includes(value)) return true
  if (['false', '0', 'no'].includes(value)) return false
  return undefined
}

function parseInteger(value: string): number | undefined {
  if (value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return undefined
  return Math.max(0, parsed)
}

const MAX_IMPORT_IMAGES = 20

export function parseProductCsvImages(val: string): Array<{ url: string; alt: null; position: number }> {
  const parts = val.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const out: Array<{ url: string; alt: null; position: number }> = []
  let pos = 0
  for (const p of parts) {
    if (p.startsWith('http')) {
      out.push({ url: p.slice(0, 2048), alt: null, position: pos })
      pos++
    }
    if (out.length >= MAX_IMPORT_IMAGES) break
  }
  return out
}

function parseTags(value: string): string[] | undefined {
  if (value === '') return undefined
  const tags = value
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
  return tags.length > 0 ? tags : undefined
}
