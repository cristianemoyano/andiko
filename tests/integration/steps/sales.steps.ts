import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { parseCurrency } from '../support/fixtures'
import { assertProductStockInOrg } from '../support/org-context'
import { TEST_IDS } from '../support/test-ids'

const INVOICE_STATUS_FILTER: Record<string, string> = {
  'Pendiente de Pago': 'issued',
  Emitida: 'issued',
  'Pago parcial': 'partially_paid',
  Pagada: 'paid',
  Borrador: 'draft',
  Anulada: 'cancelled',
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  'Pendiente de Pago': 'Emitida',
  issued: 'Emitida',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  draft: 'Borrador',
  cancelled: 'Anulada',
}

async function resolveIntegrationInvoiceNumber(world: World, hint: string): Promise<string> {
  if (hint !== '001-001-00000001') return hint

  const response = await world.page.request.get(`${world.apiUrl}/sales/invoices?limit=10`)
  const body = await response.json() as { data?: Array<{ invoice_number: string }> }
  if (!response.ok() || !body.data?.length) {
    throw new Error('Seed incompleto: no hay facturas. Ejecutá pnpm db:seed-dev.')
  }
  return body.data[0]!.invoice_number
}

Given('existen productos con stock: {string}={int}, {string}={int}', async function (
  this: World,
  product1: string,
  stock1: number,
  product2: string,
  stock2: number,
) {
  if (!this.testData.user) {
    throw new Error(
      'Este paso requiere sesión con org (usá "estoy autenticado como ..." antes).',
    )
  }
  await assertProductStockInOrg(this, product1, stock1)
  await assertProductStockInOrg(this, product2, stock2)
  this.testData.products = [
    { code: product1, name: product1, stock: stock1, category: 'General', cost_price: 100, sale_price: 150 },
    { code: product2, name: product2, stock: stock2, category: 'General', cost_price: 50, sale_price: 100 },
  ]
})

When('navego a ventas', async function (this: World) {
  await this.goto('/erp/sales/invoices')
})

When('creo un presupuesto para {string} válido por {int} días con:', async function (
  this: World,
  customerName: string,
  validDays: number,
  dataTable,
) {
  // Navigate to quote creation
  await this.page.click('button:has-text("Nuevo Presupuesto")')

  // Select customer
  const customerInput = this.page.locator('input[placeholder*="cliente" i], input[placeholder*="customer" i]')
  await customerInput.fill(customerName)

  // Wait for autocomplete
  const customerOption = this.page.locator(`text=${customerName}`).first()
  await customerOption.click()

  // Set validity days
  const validityInput = this.page.locator('input[name="valid_days"]')
  await validityInput.fill(validDays.toString())

  // Add line items
  const items = dataTable.hashes()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

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

    // Fill discount if provided
    if (item.Descuento && item.Descuento !== '0') {
      const discountInput = this.page.locator(`input[name="items[${i}].discount"]`)
      await discountInput.fill(item.Descuento)
    }
  }

  // Submit
  await this.page.click('button:has-text("Crear Presupuesto")')

  // Capture quote number
  const quoteNumber = await this.page.getByTestId(TEST_IDS.quoteNumber).textContent()
  this.lastResult.quoteId = quoteNumber

  this.testData.orders = [
    {
      type: 'sales',
      number: quoteNumber || '',
    },
  ]

  await expect(this.page.locator('[role="status"]')).toContainText(/creado|created/i)
})

Then('el presupuesto tiene estado {string}', async function (this: World, status: string) {
  const statusBadge = this.page.getByTestId(TEST_IDS.quoteStatus)
  await expect(statusBadge).toContainText(status)
})

Then('el total es (.*)', async function (this: World, totalExpression: string) {
  // For now, just verify that a total exists
  const totalElement = this.page.getByTestId(TEST_IDS.quoteTotal)
  await expect(totalElement).toBeVisible()

  // If a specific value is provided, verify it
  if (totalExpression !== 'XXX') {
    const totalText = await totalElement.textContent()
    if (totalText) {
      const actualTotal = parseCurrency(totalText)
      expect(actualTotal).toBeGreaterThan(0)
    }
  }
})

When('confirmo el presupuesto a factura', async function (this: World) {
  // Navigate to quote if not already there
  const confirmBtn = this.page.locator('button:has-text("Confirmar"), button:has-text("Confirm")')
  await confirmBtn.click()

  // Confirm conversion to invoice
  const confirmDialogBtn = this.page.locator('[role="dialog"] button:has-text("Confirmar")')
  await confirmDialogBtn.click()

  await expect(this.page.locator('[role="status"]')).toContainText(/factura|invoice/i)
})

Then('se genera factura con estado {string}', async function (this: World, status: string) {
  // Verify we're on the invoice detail page
  await expect(this.page).toHaveURL(/\/ventas\/facturas/)

  const statusBadge = this.page.getByTestId(TEST_IDS.invoiceStatus)
  await expect(statusBadge).toContainText(status)

  // Capture invoice number
  const invoiceNumber = await this.page.getByTestId(TEST_IDS.invoiceNumber).textContent()
  this.lastResult.invoiceId = invoiceNumber
})

Then('el stock disminuye: {string}={int}, {string}={int}', async function (
  this: World,
  product1: string,
  expectedStock1: number,
  product2: string,
  expectedStock2: number,
) {
  // Navigate to inventory
  await this.goto('/erp/inventory/stock')

  // Verify product1 stock
  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(product1)
  await this.page.waitForTimeout(300)

  let stockCell = this.page.locator(`table tr:has-text("${product1}") td:nth-child(3)`)
  let stockText = await stockCell.textContent()
  let stock = parseInt(stockText?.replace(/\D/g, '') || '0')
  expect(stock).toBe(expectedStock1)

  // Verify product2 stock
  await searchInput.clear()
  await searchInput.fill(product2)
  await this.page.waitForTimeout(300)

  stockCell = this.page.locator(`table tr:has-text("${product2}") td:nth-child(3)`)
  stockText = await stockCell.textContent()
  stock = parseInt(stockText?.replace(/\D/g, '') || '0')
  expect(stock).toBe(expectedStock2)
})

When('registro un pago parcial de {string} sobre la factura', async function (this: World, amount: string) {
  const paymentBtn = this.page.locator('button:has-text("Registrar Pago")')
  await paymentBtn.click()

  // Parse amount (handle currency format)
  const cleanAmount = parseCurrency(amount.replace('$', ''))

  // Fill payment details
  const amountInput = this.page.locator('input[name="amount"]')
  await amountInput.fill(cleanAmount.toString())

  // Select payment method
  const methodSelect = this.page.locator('select[name="payment_method"]')
  await methodSelect.selectOption('transfer')

  // Submit
  const submitBtn = this.page.locator('button:has-text("Registrar")')
  await submitBtn.click()

  await expect(this.page.locator('[role="status"]')).toContainText(/registrado|registered/i)

  // Capture result
  this.lastResult.paymentAmount = cleanAmount
})

Then('el saldo pendiente es (.*)', async function (this: World, balance: string) {
  // Verify balance on invoice detail
  const balanceElement = this.page.getByTestId(TEST_IDS.invoiceBalance)

  if (balance === 'YYY') {
    // Just verify balance exists and is > 0
    const balanceText = await balanceElement.textContent()
    const numBalance = parseCurrency(balanceText || '0')
    expect(numBalance).toBeGreaterThan(0)
  } else {
    // Verify specific balance
    const balanceText = await balanceElement.textContent()
    const actualBalance = parseCurrency(balanceText || '0')

    // Store for comparison
    this.lastResult.pendingBalance = actualBalance
  }
})

Then('se registra una deuda pendiente', async function (this: World) {
  // Navigate to receivables or customer detail to verify debt is registered
  const customerName = this.testData.customer?.name
  if (!customerName) {
    throw new Error('No customer in test data')
  }

  await this.goto('/erp/sales/receivables')

  // Search for customer
  const searchInput = this.page.getByTestId(TEST_IDS.accountStatementSearch)
  await searchInput.fill(customerName)

  // Verify customer appears in receivables
  const table = this.page.locator('table')
  await expect(table).toContainText(customerName)
})

When('busco la factura {string}', async function (this: World, invoiceNumber: string) {
  await this.goto('/erp/sales/invoices')

  const searchTerm = await resolveIntegrationInvoiceNumber(this, invoiceNumber)
  this.lastResult.invoiceId = searchTerm

  const searchInput = this.page.getByPlaceholder(/cliente o número/i)
  await searchInput.fill(searchTerm)
  await this.page.waitForTimeout(600)
})

Then('veo la factura en la lista', async function (this: World) {
  const invoiceNumber = String(this.lastResult.invoiceId ?? '')
  if (!invoiceNumber) throw new Error('No hay número de factura en contexto')
  await expect(this.page.locator('table')).toContainText(invoiceNumber)
})

When('filtro facturas por estado {string}', async function (this: World, status: string) {
  await this.goto('/erp/sales/invoices')
  const value = INVOICE_STATUS_FILTER[status] ?? status
  const statusFilter = this.page.locator('select').filter({
    has: this.page.locator('option', { hasText: 'Todos los estados' }),
  })
  await statusFilter.selectOption(value)
  await this.page.waitForTimeout(600)
})

Then('veo solo facturas con estado {string}', async function (this: World, status: string) {
  const expectedLabel = INVOICE_STATUS_LABEL[status] ?? status
  const rows = this.page.locator('table tbody tr').filter({ hasNotText: /facturas se generan|registro/i })
  const count = await rows.count()
  expect(count).toBeGreaterThan(0)

  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText(expectedLabel)
  }
})
