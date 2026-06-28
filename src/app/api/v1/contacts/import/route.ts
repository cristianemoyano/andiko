import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withPermission, resolveActorId } from '@/lib/api-handler'
import { TenancyError, TENANCY_ERROR_CODES, resolveTenantContext } from '@/lib/tenancy'
import { parseCsvText } from '@/lib/csv'
import { importContacts, type ImportAction } from '@/modules/contacts/contacts.service'

const importQuerySchema = z.object({
  action: z.enum(['create', 'update', 'upsert']),
  mapping: z.string().transform((v, ctx) => {
    try {
      return JSON.parse(v) as Record<string, string>
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mapping must be valid JSON' })
      return z.NEVER
    }
  }),
})

export const POST = withPermission('contacts:write', async (req, _ctx, session) => {
  const formData = await req.formData()
  const file    = formData.get('file')
  const action  = formData.get('action')
  const mapping = formData.get('mapping')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = importQuerySchema.safeParse({ action, mapping })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }

  const { action: importAction, mapping: columnMapping } = parsed.data

  const text = await file.text()
  const { rows: rawRows } = parseCsvText(text)

  // Apply column mapping: remap CSV column names to field keys
  const mappedRows = rawRows.map(raw => {
    const out: Record<string, string> = {}
    for (const [fieldKey, csvCol] of Object.entries(columnMapping)) {
      out[fieldKey] = raw[csvCol] ?? ''
    }
    return out
  })

  try {
    const ctxResult = await resolveTenantContext(session.user)
    if ('error' in ctxResult) return ctxResult.error
    const ctx = ctxResult.ctx
    const result = await importContacts(mappedRows, importAction as ImportAction, ctx, resolveActorId(session))
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
