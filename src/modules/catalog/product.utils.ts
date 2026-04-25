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
