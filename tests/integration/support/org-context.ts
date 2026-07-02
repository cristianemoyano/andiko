import type { APIResponse } from '@playwright/test'
import type { World } from './world'

type Paginated<T> = { data: T[]; total: number }

type ContactRow = {
  id: string
  legal_name: string
  cuit: string | null
}

type StockRow = {
  quantity: string | number
  variant?: {
    name?: string | null
    product?: { name?: string }
  }
}

function stockRowLabel(row: StockRow): string | undefined {
  return row.variant?.product?.name ?? row.variant?.name ?? undefined
}

function orgContextMessage(status: number, body: unknown): string {
  if (status === 422) {
    return [
      'El usuario no tiene organización en la sesión (422 ORG_CONTEXT_REQUIRED).',
      'Volvé a correr `pnpm db:seed-dev` y asegurate de usar credenciales del tenant `integration`.',
      `Respuesta: ${JSON.stringify(body)}`,
    ].join(' ')
  }
  return `API respondió ${status}: ${JSON.stringify(body)}`
}

async function parseApiResponse(response: APIResponse): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** Verifies JWT session carries an org (same check as ERP API routes). */
export async function assertOrgContext(world: World): Promise<void> {
  const response = await world.page.request.get(`${world.apiUrl}/contacts?limit=1`)
  const body = await parseApiResponse(response)
  if (!response.ok()) {
    throw new Error(orgContextMessage(response.status(), body))
  }
}

export async function findContactInOrg(
  world: World,
  opts: { name: string; cuit?: string },
): Promise<ContactRow> {
  await assertOrgContext(world)

  const search = opts.cuit ?? opts.name
  const response = await world.page.request.get(
    `${world.apiUrl}/contacts?search=${encodeURIComponent(search)}&limit=50`,
  )
  const body = (await parseApiResponse(response)) as Paginated<ContactRow> | null
  if (!response.ok() || !body?.data) {
    throw new Error(orgContextMessage(response.status(), body))
  }

  const contact =
    body.data.find((row) => row.legal_name === opts.name) ??
    (opts.cuit ? body.data.find((row) => row.cuit === opts.cuit) : undefined)

  if (!contact) {
    throw new Error(
      `Contacto "${opts.name}" no encontrado en la org de integración. Ejecutá \`pnpm db:seed-dev\`.`,
    )
  }

  return contact
}

export async function assertProductStockInOrg(
  world: World,
  productName: string,
  expectedStock: number,
): Promise<void> {
  await assertOrgContext(world)

  const response = await world.page.request.get(
    `${world.apiUrl}/inventory/stock?search=${encodeURIComponent(productName)}&limit=50`,
  )
  const body = (await parseApiResponse(response)) as Paginated<StockRow> | null
  if (!response.ok() || !body?.data) {
    throw new Error(orgContextMessage(response.status(), body))
  }

  const row = body.data.find((item) => stockRowLabel(item) === productName)
  if (!row) {
    throw new Error(
      `Producto "${productName}" sin stock en la org de integración. Ejecutá \`pnpm db:seed-dev\`.`,
    )
  }

  const qty = typeof row.quantity === 'string' ? parseFloat(row.quantity) : row.quantity
  if (qty !== expectedStock) {
    throw new Error(
      `Stock de "${productName}" esperado ${expectedStock}, encontrado ${qty} en org de integración.`,
    )
  }
}

function stockRowsForProduct(rows: StockRow[], productName: string): StockRow[] {
  return rows.filter((item) => {
    const label = stockRowLabel(item)
    if (!label) return false
    return label === productName || label.includes(productName) || productName.includes(label)
  })
}

export async function getProductStockQty(world: World, productName: string): Promise<number> {
  await assertOrgContext(world)

  const response = await world.page.request.get(
    `${world.apiUrl}/inventory/stock?search=${encodeURIComponent(productName)}&limit=50`,
  )
  const body = (await parseApiResponse(response)) as Paginated<StockRow> | null
  if (!response.ok() || !body?.data) {
    throw new Error(orgContextMessage(response.status(), body))
  }

  const matching = stockRowsForProduct(body.data, productName)
  if (matching.length === 0) return 0

  return matching.reduce((sum, row) => {
    const qty = typeof row.quantity === 'string' ? parseFloat(row.quantity) : row.quantity
    return sum + qty
  }, 0)
}
