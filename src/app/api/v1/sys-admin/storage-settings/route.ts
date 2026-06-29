import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { storageSettingsUpdateSchema } from '@/modules/storage/storage-settings.schema'
import {
  getPublicStorageSettings,
  updateStorageSettings,
} from '@/modules/storage/storage-settings.service'

export async function GET() {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  return NextResponse.json(await getPublicStorageSettings())
}

export async function PUT(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = storageSettingsUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const result = await updateStorageSettings(parsed.data)
  return NextResponse.json(result)
}
