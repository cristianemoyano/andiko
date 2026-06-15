import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { parseCurrency } from '../support/fixtures'

When('navego a compras', async function (this: World) {
  await this.goto('/erp/purchases')
})

When('creo una orden de compra para {string} con:', async function (this: World, supplierName: string, dataTable) {
  await this.page.click('button:has-text("Nueva Orden")')

  // Select supplier
  const supplierInput = this.page.locator('input[placeholder*="proveedor" i], input[placeholder*="supplier" i]')
  await supplierInput.fill(supplierName)

  // Wait for autocomplete and select
  const supplierOption = this.page.locator(`text=${supplierName}`)
  await supplierOption.first().click()

  // Add line items
  const items = dataTable.hashes()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    // Click "Agregar Producto"
    if (i > 0) {
      await this.page.click('button:has-text("Agregar Producto")')
    }

    // Fill product
    const productInput = this.page.locator(`input[name="items[${i}].product"]`)
    await productInput.fill(item.Producto)

    // Wait for autocomplete
    const productOption = this.page.locator(`text=${item.Producto}`).first()
    await productOption.click()

    // Fill quantity
    const quantityInput = this.page.locator(`input[name="items[${i}].quantity"]`)
    await quantityInput.fill(item.Cantidad)

    // Fill price (if provided)
    if (item['Precio Unitario']) {
      const priceInput = this.page.locator(`input[name="items[${i}].unit_price"]`)
      await priceInput.fill(item['Precio Unitario'])
    }
  }

  // Submit
  await this.page.click('button:has-text("Crear Orden")')

  // Capture order number
  const orderNumber = await this.page.locator('[data-testid="order-number"]').textContent()
  this.lastResult.orderId = orderNumber

  this.testData.orders = [
    {
      type: 'purchase',
      number: orderNumber || '',
    },
  ]
})

Then('la orden tiene estado {string}', async function (this: World, status: string) {
  const statusBadge = this.page.locator('[data-testid="order-status"]')
  await expect(statusBadge).toContainText(status)
})

Then('el total es {float}', async function (this: World, expectedTotal: number) {
  const totalElement = this.page.locator('[data-testid="order-total"]')
  const totalText = await totalElement.textContent()

  if (!totalText) {
    throw new Error('Could not find order total')
  }

  const actualTotal = parseCurrency(totalText)
  expect(actualTotal).toBeCloseTo(expectedTotal, 2)
})

When('registro la recepción de la orden', async function (this: World) {
  // Navigate to order detail if not already there
  const receiveBtn = this.page.locator('button:has-text("Recibir"), button:has-text("Receive")')
  await receiveBtn.click()

  // Fill received quantities (typically auto-filled with ordered amounts)
  // But we can override them
  const confirmBtn = this.page.locator('button:has-text("Confirmar"), button:has-text("Confirm")')
  await confirmBtn.click()

  await expect(this.page.locator('[role="status"]')).toContainText(/recibido|received/i)
})

Then('el stock aumenta: {string}={int}, {string}={int}', async function (
  this: World,
  product1: string,
  qty1: number,
  product2: string,
  qty2: number,
) {
  // Navigate to inventory to verify
  await this.goto('/erp/inventory/stock')

  // Search for product1
  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(product1)
  await this.page.waitForTimeout(300)

  let stockCell = this.page.locator(`table tr:has-text("${product1}") td:nth-child(3)`)
  let stockText = await stockCell.textContent()
  let stock = parseInt(stockText?.replace(/\D/g, '') || '0')
  expect(stock).toBe(qty1)

  // Search for product2
  await searchInput.clear()
  await searchInput.fill(product2)
  await this.page.waitForTimeout(300)

  stockCell = this.page.locator(`table tr:has-text("${product2}") td:nth-child(3)`)
  stockText = await stockCell.textContent()
  stock = parseInt(stockText?.replace(/\D/g, '') || '0')
  expect(stock).toBe(qty2)
})

Then('la orden cambia a {string}', async function (this: World, newStatus: string) {
  const statusBadge = this.page.locator('[data-testid="order-status"]')
  await expect(statusBadge).toContainText(newStatus)
})

When('registro un pago de {float} a {string}', async function (this: World, amount: number) {
  // Navigate to payments section
  await this.page.click('button:has-text("Registrar Pago")')

  // Fill amount
  const amountInput = this.page.locator('input[name="amount"]')
  await amountInput.fill(amount.toString())

  // Select payment method
  const methodSelect = this.page.locator('select[name="payment_method"]')
  await methodSelect.selectOption('transfer') // or similar

  // Select bank account
  const accountSelect = this.page.locator('select[name="bank_account"]')
  const firstOption = accountSelect.locator('option').nth(1)
  await accountSelect.selectOption(await firstOption.getAttribute('value'))

  // Submit
  await this.page.click('button:has-text("Registrar")')

  await expect(this.page.locator('[role="status"]')).toContainText(/registrado|registered/i)
})

Then('el saldo del proveedor es {float}', async function (this: World, expectedBalance: number) {
  // Navigate to supplier detail
  const supplierName = this.testData.supplier?.name
  if (!supplierName) {
    throw new Error('No supplier in test data')
  }

  await this.goto('/erp/contacts')

  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(supplierName)

  const row = this.page.locator(`table tr:has-text("${supplierName}")`)
  await row.click()

  // Check balance in detail view
  const balanceElement = this.page.locator('[data-testid="supplier-balance"]')
  const balanceText = await balanceElement.textContent()

  if (!balanceText) {
    throw new Error('Could not find balance element')
  }

  const actualBalance = parseCurrency(balanceText)
  expect(actualBalance).toBeCloseTo(expectedBalance, 2)
})

When('busco la orden de compra {string}', async function (this: World, orderNumber: string) {
  await this.goto('/erp/purchases')

  const searchInput = this.page.locator('input[placeholder*="orden" i], input[placeholder*="order" i]')
  await searchInput.fill(orderNumber)

  await this.page.waitForTimeout(300)
})

Then('veo la orden en la lista', async function (this: World) {
  const table = this.page.locator('table')
  const orderNumber = this.testData.orders?.[0]?.number
  await expect(table).toContainText(orderNumber || 'PO')
})

When('aplico un filtro de estado {string}', async function (this: World, status: string) {
  const statusFilter = this.page.locator('select[name="status"]')
  await statusFilter.selectOption(status)
})

Then('veo solo órdenes con estado {string}', async function (this: World, status: string) {
  const table = this.page.locator('table')
  const rows = table.locator('tbody tr')

  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i)
    const statusCell = row.locator('td:nth-child(3)') // Adjust as needed
    await expect(statusCell).toContainText(status)
  }
})
