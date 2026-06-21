import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { setDefaultTimeout } from '@cucumber/cucumber'
import type { World } from '../support/world'
import { parseCurrency } from '../support/fixtures'
import { TEST_IDS } from '../support/test-ids'
import { findContactInOrg, getProductStockQty } from '../support/org-context'

setDefaultTimeout(60 * 1000)

const PRODUCT_NAME_ALIASES: Record<string, string> = {
  Resina: 'Resina Epóxica',
  Catalizador: 'Catalizador',
}

const PRODUCT_SEARCH_ALIASES: Record<string, string> = {
  Resina: 'Resina Epóxica',
  Catalizador: 'Catalizador',
}

function resolveProductName(name: string): string {
  return PRODUCT_NAME_ALIASES[name] ?? name
}

async function selectSearchableOption(
  world: World,
  trigger: ReturnType<World['page']['getByRole']>,
  search: string,
  optionLabel: string | RegExp,
): Promise<void> {
  await trigger.click()
  const searchInput = world.page.getByPlaceholder('Buscar…')
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.fill(search)
  await world.page.waitForTimeout(800)
  await world.page.getByRole('option', { name: optionLabel }).first().click()
}

async function waitForAppReady(world: World): Promise<void> {
  for (const label of ['Compiling', 'Rendering']) {
    await world.page.getByText(label, { exact: false }).waitFor({ state: 'hidden', timeout: 30000 }).catch(() => undefined)
  }
}

async function ensureBranchSelected(world: World, force = false): Promise<void> {
  const branchTrigger = world.page.locator('#branch_id')
  await expect(branchTrigger).toBeVisible({ timeout: 10000 })
  const label = await branchTrigger.textContent()
  if (!force && label && !label.includes('Seleccionar sucursal')) return
  await selectSearchableOption(world, branchTrigger, 'Casa', /Casa Central/)
}

async function fillPurchaseLine(
  world: World,
  rowIndex: number,
  productSearch: string,
  productLabel: string | RegExp,
  quantity: string,
  unitPrice: string,
): Promise<void> {
  if (rowIndex > 0) {
    await world.page.getByRole('button', { name: '+ Agregar ítem' }).click()
    await expect(world.page.locator('table tbody tr')).toHaveCount(rowIndex + 1)
  }

  const row = world.page.locator('table tbody tr').nth(rowIndex)
  const productTrigger = row.getByRole('button', { name: 'Buscar producto…' })
  await selectSearchableOption(world, productTrigger, productSearch, productLabel)

  const qtyInput = row.locator('td').nth(2).locator('input[inputmode="decimal"]')
  await qtyInput.fill(quantity)

  const priceInput = row.locator('td').nth(3).locator('input[inputmode="decimal"]')
  await priceInput.click()
  await priceInput.fill(unitPrice.replace('.', ','))
  await priceInput.blur()
}

async function captureStockBaselines(world: World, productNames: string[]): Promise<void> {
  const baselines: Record<string, number> = {}
  for (const name of productNames) {
    baselines[name] = await getProductStockQty(world, name)
  }
  world.lastResult.stockBaselines = baselines
}

When('navego a compras', async function (this: World) {
  await this.goto('/erp/purchases/orders')
  await expect(this.page.getByRole('button', { name: 'Nueva orden' })).toBeVisible({ timeout: 10000 })
})

When('creo una orden de compra para {string} con:', async function (
  this: World,
  supplierName: string,
  dataTable,
) {
  const items = dataTable.hashes()
  const productNames = items.map((row: Record<string, string>) =>
    resolveProductName(row.Producto ?? row.producto ?? ''),
  )

  await captureStockBaselines(this, productNames)

  await this.page.getByRole('button', { name: 'Nueva orden' }).click()
  await expect(this.page).toHaveURL(/\/compras\/ordenes\/nueva/)

  await ensureBranchSelected(this)

  const supplierTrigger = this.page.getByRole('button', { name: 'Buscar proveedor…' })
  await selectSearchableOption(this, supplierTrigger, supplierName, supplierName)

  for (let i = 0; i < items.length; i++) {
    const row = items[i]
    const productSearch = PRODUCT_SEARCH_ALIASES[row.Producto ?? row.producto ?? ''] ?? row.Producto ?? row.producto ?? ''
    const productLabel = resolveProductName(productSearch)
    const quantity = row.Cantidad ?? row.cantidad ?? '1'
    const unitPrice = row['Precio Unitario'] ?? row.precio ?? '0'

    await fillPurchaseLine(this, i, productSearch, productLabel, quantity, unitPrice)
  }

  const createPromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/purchases/orders') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await waitForAppReady(this)
  await this.page.getByRole('button', { name: 'Crear orden' }).click()
  const createResponse = await createPromise
  if (!createResponse.ok()) {
    const body = await createResponse.text()
    const uiError = await this.page.locator('.text-danger').first().textContent().catch(() => null)
    throw new Error(`Crear orden falló: ${createResponse.status()} ${body}${uiError ? ` — UI: ${uiError}` : ''}`)
  }

  await this.page.waitForURL(/\/compras\/ordenes\/[0-9a-f-]+$/, { timeout: 20000 })
  const orderId = this.page.url().split('/').pop() ?? ''
  const orderNumber = await this.page.getByTestId(TEST_IDS.purchaseOrderNumber).textContent()

  this.lastResult.purchaseOrderId = orderId
  this.lastResult.orderId = orderId
  this.testData.orders = [{ type: 'purchase', number: orderNumber ?? '' }]
  this.testData.supplier = this.testData.supplier ?? { name: supplierName, cuit: '' }

  await expect(this.page.getByTestId(TEST_IDS.purchaseOrderNumber)).toBeVisible({ timeout: 10000 })
})

When('envío la orden al proveedor', async function (this: World) {
  await this.page.getByRole('button', { name: 'Enviar a proveedor' }).click()
  await expect(this.page.getByTestId(TEST_IDS.confirmDialog)).toBeVisible()
  await this.page.getByTestId(TEST_IDS.confirmDialogBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.purchaseOrderStatus)).toContainText('Enviado', { timeout: 10000 })
})

Then('la orden tiene estado {string}', async function (this: World, status: string) {
  await expect(this.page.getByTestId(TEST_IDS.purchaseOrderStatus)).toContainText(status, { timeout: 10000 })
})

Then('el total es {float}', async function (this: World, expectedTotal: number) {
  const totalFooter = this.page.getByTestId(TEST_IDS.purchaseOrderTotal)
  await expect(totalFooter).toBeVisible()
  const totalText = await totalFooter.locator('span.font-semibold.text-\\[15px\\]').textContent()
  if (!totalText) throw new Error('No se encontró el total de la orden')
  expect(parseCurrency(totalText)).toBeCloseTo(expectedTotal, 2)
})

When('registro la recepción de la orden', async function (this: World) {
  await expect(this.page.getByTestId(TEST_IDS.purchaseOrderStatus)).toContainText('Enviado', { timeout: 10000 })
  await Promise.all([
    this.page.waitForURL(/\/compras\/recepciones\/nueva/, { timeout: 15000 }),
    this.page.getByRole('button', { name: 'Registrar recepción', exact: true }).click(),
  ])

  await expect(this.page.getByText(/Recepción vinculada a la orden/)).toBeVisible({ timeout: 10000 })
  await ensureBranchSelected(this, true)

  const warehouseTrigger = this.page.getByRole('button', { name: 'Buscar depósito…' })
  await selectSearchableOption(this, warehouseTrigger, 'Depósito', /Depósito Casa Central/)

  const createPromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/purchases/receipts') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await waitForAppReady(this)
  await this.page.getByRole('button', { name: 'Crear recepción' }).click()
  const createResponse = await createPromise
  if (!createResponse.ok()) {
    const uiError = await this.page.locator('.text-danger').first().textContent().catch(() => null)
    throw new Error(`Crear recepción falló: ${createResponse.status()} ${await createResponse.text()}${uiError ? ` — UI: ${uiError}` : ''}`)
  }

  await this.page.waitForURL(/\/compras\/recepciones\/[0-9a-f-]+$/, { timeout: 20000 })

  const confirmPromise = this.page.waitForResponse(
    (r) => r.url().includes('/confirm') && r.request().method() === 'POST' && r.status() === 200,
  )
  await this.page.getByRole('button', { name: 'Confirmar recepción' }).click()
  await expect(this.page.getByTestId(TEST_IDS.confirmDialog)).toBeVisible()
  await this.page.getByTestId(TEST_IDS.confirmDialogBtn).click()
  await confirmPromise

  const orderId = this.lastResult.purchaseOrderId as string | undefined
  if (orderId) {
    await this.goto(`/compras/ordenes/${orderId}`)
    await expect(this.page.getByTestId(TEST_IDS.purchaseOrderStatus)).toContainText('Recibido', { timeout: 10000 })
  }
})

Then(/^el stock aumenta: Resina=(\d+), Catalizador=(\d+)$/, async function (
  this: World,
  qty1: string,
  qty2: string,
) {
  const fullName1 = resolveProductName('Resina')
  const fullName2 = resolveProductName('Catalizador')
  const baselines = (this.lastResult.stockBaselines ?? {}) as Record<string, number>

  const current1 = await getProductStockQty(this, fullName1)
  const current2 = await getProductStockQty(this, fullName2)
  const baseline1 = baselines[fullName1] ?? 0
  const baseline2 = baselines[fullName2] ?? 0

  expect(current1).toBeCloseTo(baseline1 + Number(qty1), 3)
  expect(current2).toBeCloseTo(baseline2 + Number(qty2), 3)
})

Then('la orden cambia a {string}', async function (this: World, newStatus: string) {
  await expect(this.page.getByTestId(TEST_IDS.purchaseOrderStatus)).toContainText(newStatus, { timeout: 10000 })
})

When('registro la factura del proveedor por la orden', async function (this: World) {
  await waitForAppReady(this)
  await Promise.all([
    this.page.waitForURL(/\/compras\/facturas\/nueva/, { timeout: 30000 }),
    this.page.getByRole('button', { name: 'Nueva factura', exact: true }).click(),
  ])

  await expect(this.page.getByText(/Vinculado a orden/)).toBeVisible({ timeout: 10000 })
  await ensureBranchSelected(this, true)

  const createPromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/purchases/supplier-invoices') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await waitForAppReady(this)
  await this.page.getByRole('button', { name: 'Crear factura' }).click()
  const createResponse = await createPromise
  if (!createResponse.ok()) {
    const uiError = await this.page.locator('.text-danger').first().textContent().catch(() => null)
    throw new Error(`Crear factura falló: ${createResponse.status()} ${await createResponse.text()}${uiError ? ` — UI: ${uiError}` : ''}`)
  }

  const created = await createResponse.json() as { id?: string }
  if (created.id) {
    await this.goto(`/compras/facturas/${created.id}`)
  } else {
    await this.page.waitForURL(/\/compras\/facturas\/[0-9a-f-]+$/, { timeout: 20000 })
  }
  this.lastResult.supplierInvoiceId = created.id ?? this.page.url().split('/').pop()

  const receivePromise = this.page.waitForResponse(
    (r) => r.url().includes('/receive') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await this.page.getByRole('button', { name: 'Marcar como recibida' }).click()
  await expect(this.page.getByTestId(TEST_IDS.confirmDialog)).toBeVisible()
  await this.page.getByTestId(TEST_IDS.confirmDialogBtn).click()
  await receivePromise

  await expect(this.page.getByTestId(TEST_IDS.supplierInvoiceStatus)).toContainText('Recibida', { timeout: 10000 })
})

When('registro un pago de {float} a {string}', async function (this: World, amount: number, supplierName: string) {
  const paymentPromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/purchases/supplier-payments') && r.request().method() === 'POST',
  )
  await this.page.getByRole('button', { name: 'Registrar pago' }).click()
  const paymentResponse = await paymentPromise
  if (!paymentResponse.ok()) {
    throw new Error(`Registrar pago falló: ${paymentResponse.status()} ${await paymentResponse.text()}`)
  }

  this.testData.supplier = { ...this.testData.supplier, name: supplierName }
  this.lastResult.paymentAmount = amount
  await expect(this.page.getByTestId(TEST_IDS.supplierInvoiceStatus)).toContainText('Pagada', { timeout: 10000 })
})

When('registro un pago del total de la factura a {string}', async function (this: World, supplierName: string) {
  const paymentPromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/purchases/supplier-payments') && r.request().method() === 'POST',
    { timeout: 30000 },
  )
  await waitForAppReady(this)
  await this.page.getByRole('button', { name: 'Registrar pago' }).click()
  const paymentResponse = await paymentPromise
  if (!paymentResponse.ok()) {
    throw new Error(`Registrar pago falló: ${paymentResponse.status()} ${await paymentResponse.text()}`)
  }

  this.testData.supplier = { ...this.testData.supplier, name: supplierName }
  await expect(this.page.getByTestId(TEST_IDS.supplierInvoiceStatus)).toContainText('Pagada', { timeout: 10000 })
})

Then('la factura del proveedor está {string}', async function (this: World, status: string) {
  await expect(this.page.getByTestId(TEST_IDS.supplierInvoiceStatus)).toContainText(status, { timeout: 10000 })
})

Then('el saldo del proveedor es {float}', async function (this: World, expectedBalance: number) {
  const supplierName = this.testData.supplier?.name
  if (!supplierName) throw new Error('No hay proveedor en contexto')

  const contact = await findContactInOrg(this, { name: supplierName })
  const response = await this.page.request.get(
    `${this.apiUrl}/purchases/contacts/${contact.id}/account-statement?limit=1`,
  )
  const body = await response.json() as { summary?: { balance?: string } }
  if (!response.ok()) {
    throw new Error(`No se pudo leer cuenta corriente del proveedor: ${response.status()}`)
  }

  const balance = Number(body.summary?.balance ?? NaN)
  expect(balance).toBeCloseTo(expectedBalance, 2)
})

When('busco la orden de compra {string}', async function (this: World, orderNumber: string) {
  await this.goto('/erp/purchases/orders')
  const searchInput = this.page.locator('input[placeholder*="Buscar" i]')
  await searchInput.fill(orderNumber)
  await this.page.waitForTimeout(500)
})

Then('veo la orden en la lista', async function (this: World) {
  const orderNumber = this.testData.orders?.[0]?.number
  await expect(this.page.locator('table')).toContainText(orderNumber || 'OC')
})

When('aplico un filtro de estado {string}', async function (this: World, status: string) {
  const statusFilter = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: 'Todos los estados' }) })
  await statusFilter.selectOption({ label: status })
  await this.page.waitForTimeout(500)
})

Then('veo solo órdenes con estado {string}', async function (this: World, status: string) {
  const rows = this.page.locator('table tbody tr')
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(status)
  }
})
