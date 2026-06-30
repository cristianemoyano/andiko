export type ImportProgressCallback = (processed: number, total: number) => void

/** Emite progreso como máximo cada ~250 ms o cada 25 filas para no saturar el stream. */
export function createImportProgressReporter(
  total: number,
  onProgress?: ImportProgressCallback,
): { tick: (processed: number) => void; finish: () => void } {
  let lastEmitAt = 0
  let lastProcessed = 0

  const emit = (processed: number) => {
    if (!onProgress || total <= 0) return
    const clamped = Math.min(Math.max(processed, 0), total)
    lastProcessed = clamped
    onProgress(clamped, total)
  }

  return {
    tick(processed: number) {
      if (!onProgress || total <= 0) return
      const now = Date.now()
      if (
        processed >= total ||
        processed % 10 === 0 ||
        now - lastEmitAt >= 200
      ) {
        lastEmitAt = now
        emit(processed)
      }
    },
    finish() {
      emit(total > 0 ? total : lastProcessed)
    },
  }
}

export type ImportStreamProgressEvent = {
  type: 'progress'
  processed: number
  total: number
}

export type ImportStreamDoneEvent = {
  type: 'done'
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export type ImportStreamCancelledEvent = {
  type: 'cancelled'
  updated: number
  skipped: number
  processed: number
  total: number
}

export type ImportStreamErrorEvent = {
  type: 'error'
  error: string
  errors?: { row: number; message: string }[]
}

export type ImportStreamEvent =
  | ImportStreamProgressEvent
  | ImportStreamDoneEvent
  | ImportStreamCancelledEvent
  | ImportStreamErrorEvent

export function isImportAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  return error instanceof Error && error.name === 'AbortError'
}

/** Lee una respuesta NDJSON del import y reporta progreso en tiempo real. */
export async function readImportStream(
  response: Response,
  onProgress: (processed: number, total: number) => void,
  options?: { signal?: AbortSignal },
): Promise<ImportStreamDoneEvent> {
  const signal = options?.signal
  const reader = response.body?.getReader()
  if (!reader) throw new Error('IMPORT_STREAM_UNAVAILABLE')

  const decoder = new TextDecoder()
  let buffer = ''
  let result: ImportStreamDoneEvent | null = null

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException('La operación fue cancelada.', 'AbortError')
    }
  }

  try {
    while (true) {
      throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as ImportStreamEvent
        if (event.type === 'progress') {
          onProgress(event.processed, event.total)
        } else if (event.type === 'done') {
          result = event
        } else if (event.type === 'cancelled') {
          const err = new Error('IMPORT_STREAM_CANCELLED') as Error & {
            cancelled: ImportStreamCancelledEvent
          }
          err.cancelled = event
          throw err
        } else if (event.type === 'error') {
          const err = new Error(event.error) as Error & {
            importErrors?: ImportStreamErrorEvent['errors']
          }
          err.importErrors = event.errors
          throw err
        }
      }
    }
  } finally {
    if (signal?.aborted) {
      try {
        await reader.cancel()
      } catch {
        /* ya cerrado */
      }
    }
  }

  throwIfAborted()

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ImportStreamEvent
    if (event.type === 'done') result = event
    else if (event.type === 'progress') onProgress(event.processed, event.total)
    else if (event.type === 'cancelled') {
      const err = new Error('IMPORT_STREAM_CANCELLED') as Error & {
        cancelled: ImportStreamCancelledEvent
      }
      err.cancelled = event
      throw err
    }
    else if (event.type === 'error') throw new Error(event.error)
  }

  if (!result) throw new Error('IMPORT_STREAM_INCOMPLETE')
  return result
}

export function encodeImportStreamEvent(event: ImportStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function formatImportEtaRemaining(processed: number, total: number, elapsedMs: number): string | null {
  if (processed <= 0 || total <= 0 || processed >= total || elapsedMs < 500) return null
  const remainingMs = (elapsedMs / processed) * (total - processed)
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null
  const sec = Math.ceil(remainingMs / 1000)
  if (sec < 60) return `~${sec} s restantes`
  const min = Math.ceil(sec / 60)
  return min === 1 ? '~1 min restante' : `~${min} min restantes`
}
