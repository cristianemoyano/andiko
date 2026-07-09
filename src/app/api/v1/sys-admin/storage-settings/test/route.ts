import { NextResponse } from 'next/server'
import { requireSysAdmin } from '@/lib/sys-admin-guard'
import { storageTestDeleteSchema, storageTestSchema } from '@/modules/storage/storage-settings.schema'
import { STORAGE_ERRORS } from '@/modules/storage/storage.service'
import {
  deleteStorageTestObject,
  runStorageConnectivityTest,
  STORAGE_TEST_FAILED,
  STORAGE_TEST_INVALID_KEY,
} from '@/modules/storage/storage-test.service'

export async function POST(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown = {}
  try {
    const text = await req.text()
    if (text.trim()) json = JSON.parse(text) as unknown
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = storageTestSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const result = await runStorageConnectivityTest()
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const response = storageTestErrorResponse(err)
    if (response) return response
    throw err
  }
}

export async function DELETE(req: Request) {
  const gate = await requireSysAdmin()
  if ('response' in gate) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const parsed = storageTestDeleteSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    await deleteStorageTestObject(parsed.data.storage_key)
    return NextResponse.json({ ok: true, storage_key: parsed.data.storage_key })
  } catch (err: unknown) {
    const response = storageTestErrorResponse(err, 'eliminar')
    if (response) return response
    throw err
  }
}

function storageTestErrorResponse(err: unknown, action: 'probar' | 'eliminar' = 'probar'): NextResponse | null {
  if (err instanceof Error && err.message === STORAGE_ERRORS.STORAGE_NOT_CONFIGURED) {
    return NextResponse.json(
      {
        error:
          'No hay almacenamiento habilitado. Activá el servicio, completá las credenciales y guardá antes de probar.',
        code: STORAGE_ERRORS.STORAGE_NOT_CONFIGURED,
      },
      { status: 409 },
    )
  }
  if (err instanceof Error && err.message === STORAGE_TEST_INVALID_KEY) {
    return NextResponse.json(
      { error: 'La clave no corresponde a un archivo de prueba de sys-admin.', code: STORAGE_TEST_INVALID_KEY },
      { status: 400 },
    )
  }
  if (err instanceof Error && err.message === STORAGE_TEST_FAILED) {
    const detail = (err as Error & { detail?: string }).detail ?? 'Error desconocido'
    const verb = action === 'eliminar' ? 'eliminar' : 'completar la prueba de almacenamiento'
    return NextResponse.json(
      { error: `No se pudo ${verb}: ${detail}`, code: STORAGE_TEST_FAILED },
      { status: 502 },
    )
  }
  return null
}
