import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { parseCsvText } from '@/lib/csv'
import { importEmployees, type EmployeeImportAction } from '@/modules/attendance/employees.service'

const importParamsSchema = z.object({
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

export const POST = withTenantPermission('employees:write', async (req, _ctx, session, ctx) => {
  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = importParamsSchema.safeParse({
    action: formData.get('action'),
    mapping: formData.get('mapping'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid params', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { action, mapping } = parsed.data

  try {
    const text = await file.text()
    const { rows: rawRows } = parseCsvText(text)

    const mappedRows = rawRows.map(raw => {
      const out: Record<string, string> = {}
      for (const [fieldKey, csvCol] of Object.entries(mapping)) {
        out[fieldKey] = raw[csvCol] ?? ''
      }
      return out
    })

    const result = await importEmployees(
      mappedRows,
      action as EmployeeImportAction,
      ctx,
      resolveActorId(session),
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'IMPORT_VALIDATION_ERRORS') {
      const importErrors = (err as Error & { importErrors: unknown[] }).importErrors
      return NextResponse.json(
        { created: 0, updated: 0, skipped: 0, errors: importErrors },
        { status: 422 },
      )
    }
    return attendanceErrorResponse(err)
  }
})
