export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255)
}

export function formatSku(sku: string): string {
  return sku.trim().toUpperCase()
}

/** Slug estable cuando hay correlación de import (evita colisiones entre productos con el mismo nombre). */
/** Alinea imágenes del schema Zod con el tipo JSONB del modelo (alt obligatorio). */
export function normalizeProductImagesForDb(
  images: Array<{ url: string; alt?: string | null; position: number }> | undefined,
): Array<{ url: string; alt: string | null; position: number }> {
  if (!images?.length) return []
  return images.map((im) => ({ url: im.url, alt: im.alt ?? null, position: im.position }))
}

export function slugForImportedProduct(name: string, importExternalId: string | null | undefined): string {
  const ext = importExternalId?.trim() ?? ''
  if (!ext) return generateSlug(name)
  const base = generateSlug(name)
  const suffix = `-i-${ext}`.slice(0, 80)
  return `${base}${suffix}`.slice(0, 265)
}

/** Etiqueta de variante para listados: nombre del producto y, si difiere, el de la variante. */
export function variantDisplayName(productName: string, variantName: string | null | undefined): string {
  const product = productName.trim()
  const variant = (variantName ?? '').trim()
  if (variant && variant !== product) return `${product} — ${variant}`
  return product || variant
}

const ZERO_PRICE = '0.00'

/** Precio base en importación / backfill: vacío → $0 (producto igual entra al catálogo y a la lista). */
export function importBasePrice(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  if (trimmed === '') return ZERO_PRICE
  return trimmed.replace(',', '.')
}

export function isMissingBasePrice(value: string | null | undefined): boolean {
  return (value ?? '').trim() === ''
}
