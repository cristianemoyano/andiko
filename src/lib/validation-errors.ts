import { isApiRequestError } from '@/lib/fetch-json'

export type FieldErrors = Record<string, string[]>

/** Extrae `fieldErrors` del body 422 `VALIDATION_ERROR` de la API. */
export function fieldErrorsFromApiError(e: unknown): FieldErrors | null {
  if (!isApiRequestError(e) || e.code !== 'VALIDATION_ERROR') return null
  if (!e.details || typeof e.details !== 'object') return null
  const fe = (e.details as { fieldErrors?: FieldErrors }).fieldErrors
  return fe && typeof fe === 'object' ? fe : null
}
