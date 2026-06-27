import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { makeTenantContext, TenancyError, TENANCY_ERROR_CODES } from '@/lib/tenancy'
import { parseCsvText } from '@/lib/csv'
import { encodeImportStreamEvent } from '@/lib/import-progress'
import { sanitizeImportDefaultsFromClient } from '@/modules/catalog/products-csv-adapter'
import { importProducts, type ImportAction } from '@/modules/catalog/products.service'

const importQuerySchema = z.object({
  action: z.enum(['create', 'update', 'upsert']),
  mapping: z.string().transform((value, ctx) => {
    try {
      return JSON.parse(value) as Record<string, string>
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mapping must be valid JSON' })
      return z.NEVER
    }
  }),
  import_source: z.string().max(32).optional(),
  stream: z
    .string()
    .optional()
    .transform((value) => value === '1' || value === 'true'),
})

export const POST = withPermission('products:write', async (req, _ctx, session) => {
  const formData = await req.formData()
  const file = formData.get('file')
  const action = formData.get('action')
  const mapping = formData.get('mapping')
  const import_source = formData.get('import_source')
  const import_defaults = formData.get('import_defaults')
  const stream = formData.get('stream')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = importQuerySchema.safeParse({
    action,
    mapping,
    import_source: typeof import_source === 'string' ? import_source : undefined,
    stream: typeof stream === 'string' ? stream : undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const text = await file.text()
  const { rows: rawRows } = parseCsvText(text)

  const mappedRows = rawRows.map((raw) => {
    const out: Record<string, string> = {}
    for (const [fieldKey, csvColumn] of Object.entries(parsed.data.mapping)) {
      out[fieldKey] = raw[csvColumn] ?? ''
    }
    return out
  })

  const runImport = async (onProgress?: (processed: number, total: number) => void) => {
    const ctx = await makeTenantContext(session.user)
    const importSource = parsed.data.import_source?.trim() || 'catalog_csv'
    const importDefaults = sanitizeImportDefaultsFromClient(
      typeof import_defaults === 'string' ? import_defaults : undefined,
    )
    return importProducts(
      rawRows,
      mappedRows,
      parsed.data.mapping,
      parsed.data.action as ImportAction,
      ctx,
      resolveActorId(session),
      importSource,
      importDefaults,
      onProgress,
    )
  }

  if (parsed.data.stream) {
    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (chunk: Uint8Array) => controller.enqueue(chunk)
        try {
          const result = await runImport((processed, total) => {
            enqueue(encodeImportStreamEvent({ type: 'progress', processed, total }))
          })
          enqueue(encodeImportStreamEvent({ type: 'done', ...result }))
        } catch (err: unknown) {
          if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
            enqueue(encodeImportStreamEvent({ type: 'error', error: 'No hay organización en contexto.' }))
          } else if (err instanceof Error && err.message === 'IMPORT_VALIDATION_ERRORS') {
            const importErrors = (err as Error & { importErrors: { row: number; message: string }[] }).importErrors
            enqueue(encodeImportStreamEvent({
              type: 'error',
              error: 'Errores de validación en la importación',
              errors: importErrors,
            }))
          } else {
            enqueue(encodeImportStreamEvent({
              type: 'error',
              error: err instanceof Error ? err.message : 'Error al importar',
            }))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(streamBody, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  try {
    const result = await runImport()
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof Error && err.message === 'IMPORT_VALIDATION_ERRORS') {
      const importErrors = (err as Error & { importErrors: unknown[] }).importErrors
      return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors: importErrors }, { status: 422 })
    }
    throw err
  }
})
