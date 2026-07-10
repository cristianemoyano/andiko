import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { attendanceErrorResponse } from '@/lib/attendance-route-errors'
import { parseCsvText } from '@/lib/csv'
import { importAttendanceEvents } from '@/modules/attendance/attendance-events.service'

const importParamsSchema = z.object({
  branch_id: z.string().uuid(),
  alias_clock_in: z.string().min(1),
  alias_clock_out: z.string().min(1),
  mapping: z.string().transform((v, ctx) => {
    try {
      return JSON.parse(v) as Record<string, string>
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'mapping must be valid JSON' })
      return z.NEVER
    }
  }),
})

export const POST = withTenantPermission('attendance:write', async (req, _routeCtx, session, ctx) => {
  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = importParamsSchema.safeParse({
    branch_id: formData.get('branch_id'),
    alias_clock_in: formData.get('alias_clock_in'),
    alias_clock_out: formData.get('alias_clock_out'),
    mapping: formData.get('mapping'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid params', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const { branch_id, alias_clock_in, alias_clock_out, mapping } = parsed.data

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

    const actorId = resolveActorId(session)
    const result = await importAttendanceEvents(
      mappedRows,
      ctx,
      actorId,
      branch_id,
      { clockIn: alias_clock_in, clockOut: alias_clock_out },
    )
    return NextResponse.json(result)
  } catch (err) {
    return attendanceErrorResponse(err)
  }
})
