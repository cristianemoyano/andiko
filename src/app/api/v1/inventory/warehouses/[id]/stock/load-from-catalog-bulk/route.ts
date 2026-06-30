import { NextResponse } from 'next/server'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { encodeImportStreamEvent } from '@/lib/import-progress'
import { bulkLoadCatalogStockFromFilterSchema } from '@/modules/inventory/warehouse-catalog-stock.schema'
import {
  bulkLoadCatalogStockForFilter,
  BulkLoadCancelledError,
} from '@/modules/inventory/warehouse-catalog-stock.service'

type P = { id: string }

export const POST = withPermission<P>('inventory:write', async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = bulkLoadCatalogStockFromFilterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  const runBulk = async (onProgress?: (processed: number, total: number) => void, signal?: AbortSignal) => {
    const tenantResult = await resolveTenantContext(session.user)
    if ('error' in tenantResult) {
      throw new TenancyError(TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED)
    }
    return bulkLoadCatalogStockForFilter(
      id,
      parsed.data,
      tenantResult.ctx,
      resolveActorId(session),
      onProgress,
      signal,
    )
  }

  if (parsed.data.stream) {
    const signal = req.signal
    const streamBody = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (chunk: Uint8Array) => controller.enqueue(chunk)
        try {
          const result = await runBulk((processed, total) => {
            if (signal.aborted) return
            enqueue(encodeImportStreamEvent({ type: 'progress', processed, total }))
          }, signal)

          if (result.cancelled) {
            enqueue(encodeImportStreamEvent({
              type:    'cancelled',
              updated: result.updated,
              skipped: result.skipped + result.unchanged,
              processed: result.processed,
              total:   result.total,
            }))
          } else {
            enqueue(encodeImportStreamEvent({
              type: 'done',
              created: 0,
              updated: result.updated,
              skipped: result.skipped + result.unchanged,
              errors: [],
            }))
          }
        } catch (err: unknown) {
          if (err instanceof BulkLoadCancelledError) {
            const { result } = err
            enqueue(encodeImportStreamEvent({
              type:    'cancelled',
              updated: result.updated,
              skipped: result.skipped + result.unchanged,
              processed: result.processed,
              total:   result.total,
            }))
          } else if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
            enqueue(encodeImportStreamEvent({ type: 'error', error: 'No hay organización en contexto.' }))
          } else if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
            enqueue(encodeImportStreamEvent({ type: 'error', error: 'No tenés acceso a esa sucursal.' }))
          } else if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
            enqueue(encodeImportStreamEvent({ type: 'error', error: 'Depósito no encontrado.' }))
          } else {
            enqueue(encodeImportStreamEvent({
              type: 'error',
              error: err instanceof Error ? err.message : 'Error al cargar stock',
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
    const result = await runBulk(undefined, req.signal)
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (err instanceof BulkLoadCancelledError) {
      return NextResponse.json(err.result, { status: 499 })
    }
    if (err instanceof TenancyError) {
      if (err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
        return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
      }
      if (err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
        return NextResponse.json({ error: 'No tenés acceso a esa sucursal.', code: err.code }, { status: 403 })
      }
    }
    if (err instanceof Error && err.message === 'WAREHOUSE_NOT_FOUND') {
      return NextResponse.json({ error: 'Depósito no encontrado', code: 'NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
