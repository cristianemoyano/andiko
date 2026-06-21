import { NextRequest, NextResponse } from 'next/server'
import { withPosDevice } from '@/lib/pos-auth'
import { posSaleAuthorizeSchema } from '@/modules/pos/pos-fiscal.schema'
import { authorizePosSale } from '@/modules/pos/pos-fiscal.service'
import { mapAfipErrorResponse } from '@/modules/afip/afip-http-errors'

export const POST = withPosDevice(async (req: NextRequest, ctx) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'PARSE_ERROR' }, { status: 400 })
  }

  const parsed = posSaleAuthorizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const fiscal = await authorizePosSale(ctx, parsed.data)
    return NextResponse.json(fiscal)
  } catch (err) {
    return mapAfipErrorResponse(err)
  }
})
