export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, opts: { status: number; code: string; details?: unknown }) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = opts.status
    this.code = opts.code
    this.details = opts.details
  }
}

function parseErrorBody(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { error: text }
  }
}

function bodyToApiFields(body: unknown): { message: string; code: string; details?: unknown } {
  if (!body || typeof body !== 'object') {
    return { message: 'Error desconocido', code: 'UNKNOWN' }
  }
  const o = body as Record<string, unknown>
  const error = typeof o.error === 'string' ? o.error : null
  const code = typeof o.code === 'string' ? o.code : 'UNKNOWN'
  const details = o.details
  return {
    message: error ?? 'La solicitud no pudo completarse.',
    code,
    ...(details !== undefined ? { details } : {}),
  }
}

/**
 * Typed JSON fetch for browser calls to same-origin `/api/v1/...`.
 * Throws {@link ApiRequestError} when the response is not OK.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(input, {
    credentials: 'same-origin',
    ...init,
    headers,
  })

  const text = await res.text()

  if (!res.ok) {
    const parsed = parseErrorBody(text)
    const { message, code, details } = bodyToApiFields(parsed)
    throw new ApiRequestError(message, { status: res.status, code, details })
  }

  if (!text.trim()) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiRequestError('La respuesta no es JSON válido.', {
      status: res.status,
      code: 'INVALID_JSON',
    })
  }
}

export function isApiRequestError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError
}

export function getApiErrorMessage(e: unknown): string {
  if (isApiRequestError(e)) {
    return e.code && e.code !== 'UNKNOWN' ? `${e.message} (${e.code})` : e.message
  }
  if (e instanceof Error) return e.message
  return 'Ocurrió un error inesperado.'
}
