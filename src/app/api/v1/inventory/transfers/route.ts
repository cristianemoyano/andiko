import { NextResponse } from 'next/server'
import { withPermission } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { stockTransferAllSchema, stockTransferBatchSchema, stockTransferSchema } from '@/modules/inventory/stock-transfer.schema'
import { transferAllStock, transferStock, transferStockBatch } from '@/modules/inventory/stock-transfer.service'

export const POST = withPermission('inventory:write', async (req, _ctx, session) => {
  const body = await req.json()
  const mode = body?.mode === 'all' ? 'all' : body?.mode === 'batch' || Array.isArray(body?.items) ? 'batch' : 'single'

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx

    if (mode === 'batch') {
      const parsed = stockTransferBatchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
      }
      const result = await transferStockBatch(parsed.data, ctx)
      return NextResponse.json(result, { status: 201 })
    }

    if (mode === 'all') {
      const parsed = stockTransferAllSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
      }
      const result = await transferAllStock(parsed.data, ctx)
      return NextResponse.json(result, { status: 201 })
    }

    const parsed = stockTransferSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
    }
    const result = await transferStock(parsed.data, ctx)
    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.ORG_CONTEXT_REQUIRED) {
      return NextResponse.json({ error: 'No hay organización en contexto.', code: err.code }, { status: 422 })
    }
    if (err instanceof TenancyError && err.code === TENANCY_ERROR_CODES.BRANCH_NOT_ALLOWED) {
      return NextResponse.json({ error: 'Depósito fuera de tu sucursal permitida.', code: err.code }, { status: 403 })
    }
    if (err instanceof Error) {
      if (err.message === 'INSUFFICIENT_STOCK') {
        return NextResponse.json({ error: 'Stock insuficiente en el depósito origen', code: 'INSUFFICIENT_STOCK' }, { status: 409 })
      }
      if (err.message === 'VARIANT_NOT_FOUND') {
        return NextResponse.json({ error: 'Variante no encontrada', code: 'VARIANT_NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'VARIANT_STOCK_NOT_MANAGED') {
        return NextResponse.json({ error: 'El producto no gestiona stock', code: 'VARIANT_STOCK_NOT_MANAGED' }, { status: 422 })
      }
      if (err.message === 'WAREHOUSE_NOT_FOUND') {
        return NextResponse.json({ error: 'Depósito no encontrado', code: 'WAREHOUSE_NOT_FOUND' }, { status: 404 })
      }
      if (err.message === 'WAREHOUSE_INACTIVE') {
        return NextResponse.json({ error: 'Depósito inactivo', code: 'WAREHOUSE_INACTIVE' }, { status: 422 })
      }
      if (err.message === 'TRANSFER_BATCH_EMPTY') {
        return NextResponse.json({ error: 'Ningún producto pudo transferirse', code: 'TRANSFER_BATCH_EMPTY' }, { status: 422 })
      }
    }
    throw err
  }
})
