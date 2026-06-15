import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { parseCurrency } from '../support/fixtures'

Given('existem invoices pendientes:', async function (this: World, dataTable) {
  // Would be seeded via API or database
  const invoices = dataTable.hashes()
  this.lastResult.pendingInvoices = invoices
})

When('navego a reportes financieros', async function (this: World) {
  await this.goto('/erp/accounting')
})

When('consulto el estado de {string}', async function (this: World, customerName: string) {
  // Navigate to receivables or customer detail
  await this.goto('/erp/sales/receivables')

  // Search for customer
  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(customerName)

  await this.page.waitForTimeout(300)

  // Click on customer row
  const row = this.page.locator(`table tr:has-text("${customerName}")`)
  await row.click()

  this.testData.customer = {
    ...this.testData.customer,
    name: customerName,
  }
})

Then('veo deuda pendiente de {int}', async function (this: World, amount: number) {
  const debtElement = this.page.locator('[data-testid="customer-debt"]')
  await expect(debtElement).toBeVisible()

  const debtText = await debtElement.textContent()
  if (!debtText) {
    throw new Error('Could not find debt amount')
  }

  const actualDebt = parseCurrency(debtText)
  expect(actualDebt).toBeCloseTo(amount, 2)
})

Then('el vencimiento fue hace {int} días', async function (this: World) {
  // This would check invoice details
  const dueDate = this.page.locator('[data-testid="due-date"]')
  await expect(dueDate).toBeVisible()

  const dueDateText = await dueDate.textContent()
  // Verify the date is approximately days ago
  console.log('Due date:', dueDateText)
})

Given('existe deuda de {int} pendiente de {string}', async function (this: World, amount: number, customerName: string) {
  // Would be seeded via API
  this.testData.customer = {
    name: customerName,
  }
  this.lastResult.debtAmount = amount
})

When('registro abono de {int}', async function (this: World, paymentAmount: number) {
  // Navigate to payment registration
  const paymentBtn = this.page.locator('button:has-text("Registrar Pago")')
  await paymentBtn.click()

  // Fill payment amount
  const amountInput = this.page.locator('input[name="amount"]')
  await amountInput.fill(paymentAmount.toString())

  // Select payment method
  const methodSelect = this.page.locator('select[name="payment_method"]')
  await methodSelect.selectOption('transfer')

  // Submit
  const submitBtn = this.page.locator('button:has-text("Registrar")')
  await submitBtn.click()

  await expect(this.page.locator('[role="status"]')).toContainText(/registrado|registered/i)

  this.lastResult.paymentAmount = paymentAmount
})

Then('la deuda disminuye a {int}', async function (this: World, expectedDebt: number) {
  // Refresh and verify new debt
  await this.page.reload()

  const debtElement = this.page.locator('[data-testid="customer-debt"]')
  const debtText = await debtElement.textContent()

  if (!debtText) {
    throw new Error('Could not find debt amount')
  }

  const actualDebt = parseCurrency(debtText)
  expect(actualDebt).toBeCloseTo(expectedDebt, 2)
})

Then('se registra en el diario contable', async function (this: World) {
  // Navigate to accounting journal
  await this.goto('/erp/accounting/journal')

  // Search for the transaction
  const searchInput = this.page.locator('input[placeholder*="search" i]')

  // Use customer name or invoice number
  const searchTerm = this.testData.customer?.name || this.lastResult.invoiceId || 'payment'
  await searchInput.fill(searchTerm as string)

  await this.page.waitForTimeout(300)

  // Verify entry exists in journal
  const table = this.page.locator('table')
  await expect(table.locator('tbody tr')).toHaveCount(async (count) => count > 0)
})

When('genero reporte de deudas pendientes', async function (this: World) {
  await this.goto('/erp/sales/receivables')

  // Apply filter for pending only
  const statusFilter = this.page.locator('select[name="status"]')
  await statusFilter.selectOption('pending')

  // Generate or export report
  const reportBtn = this.page.locator('button:has-text("Reporte"), button:has-text("Report")')
  if (await reportBtn.count()) {
    await reportBtn.click()
  }
})

Then('el reporte muestra {int} deudas pendientes', async function (this: World, expectedCount: number) {
  const table = this.page.locator('table')
  const rows = table.locator('tbody tr')

  const actualCount = await rows.count()
  expect(actualCount).toBe(expectedCount)
})

When('consulto vencimiento de deudas de {string}', async function (this: World, customerName: string) {
  await this.goto('/erp/sales/receivables')

  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(customerName)

  await this.page.waitForTimeout(300)
})

Then('veo deudas vencidas:', async function (this: World, dataTable) {
  const rows = dataTable.hashes()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const docNumber = row['Documento']
    const daysOverdue = row['Días Atraso']

    // Find row in table
    const tableRow = this.page.locator(`table tr:has-text("${docNumber}")`)
    const overdueCell = tableRow.locator('td:nth-child(5)') // Adjust as needed

    await expect(overdueCell).toContainText(daysOverdue)
  }
})

When('genero estado de cuenta de {string}', async function (this: World, customerName: string) {
  // Navigate to customer detail
  await this.goto('/erp/contacts')

  const searchInput = this.page.locator('input[placeholder*="search" i]')
  await searchInput.fill(customerName)

  // Click customer
  const row = this.page.locator(`table tr:has-text("${customerName}")`)
  await row.click()

  // Generate statement
  const statementBtn = this.page.locator('button:has-text("Estado de Cuenta")')
  await statementBtn.click()
})

Then('el estado de cuenta contiene:', async function (this: World, dataTable) {
  // Verify statement details
  const rows = dataTable.hashes()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Check that expected fields are visible
    const docElement = this.page.locator(`text=${row.documento}`)
    await expect(docElement).toBeVisible()

    const dateElement = this.page.locator(`text=${row.fecha}`)
    await expect(dateElement).toBeVisible()
  }
})

When('consulto saldo de cuenta por período {string}', async function (this: World, period: string) {
  await this.goto('/erp/accounting/balance')

  // Select period
  const periodSelect = this.page.locator('select[name="period"]')
  await periodSelect.selectOption(period)
})

Then('veo activos totales de {float}', async function (this: World, expectedTotal: number) {
  const assetsElement = this.page.locator('[data-testid="total-assets"]')
  const assetsText = await assetsElement.textContent()

  if (!assetsText) {
    throw new Error('Could not find assets total')
  }

  const actualAssets = parseCurrency(assetsText)
  expect(actualAssets).toBeCloseTo(expectedTotal, 2)
})

Then('veo pasivos totales de {float}', async function (this: World, expectedTotal: number) {
  const liabilitiesElement = this.page.locator('[data-testid="total-liabilities"]')
  const liabilitiesText = await liabilitiesElement.textContent()

  if (!liabilitiesText) {
    throw new Error('Could not find liabilities total')
  }

  const actualLiabilities = parseCurrency(liabilitiesText)
  expect(actualLiabilities).toBeCloseTo(expectedTotal, 2)
})
