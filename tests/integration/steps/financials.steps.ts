import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { parseCurrency } from '../support/fixtures'
import { TEST_IDS } from '../support/test-ids'
import { expectToast } from '../support/toast'

import { findContactInOrg } from '../support/org-context'

type OpenInvoice = { id: string; balance: string; status: string }

const MOVEMENT_TYPE_BY_LABEL: Record<string, 'invoice' | 'payment' | 'credit_note'> = {
  Factura: 'invoice',
  Cobro: 'payment',
  'Nota de crédito': 'credit_note',
}

function movementTableRow(world: World, movementType: 'invoice' | 'payment' | 'credit_note') {
  return world.page.locator('table tbody tr').filter({
    has: world.page.locator(
      `[data-testid="${TEST_IDS.accountMovementRow}"][data-movement-type="${movementType}"]`,
    ),
  })
}

function formatAmountForUi(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

function parseAccountingPeriod(period: string): { from: string; to: string } {
  const match = period.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    throw new Error(`Período inválido: ${period}. Usá formato YYYY-MM.`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const from = `${match[1]}-${match[2]}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

async function resetInvoicePayments(world: World, invoiceId: string): Promise<void> {
  const listRes = await world.page.request.get(
    `${world.apiUrl}/sales/payments?invoice_id=${invoiceId}&limit=50`,
  )
  const body = await listRes.json() as { data?: Array<{ id: string }> }
  if (!listRes.ok() || !body.data) return

  for (const payment of body.data) {
    const deleteRes = await world.page.request.delete(`${world.apiUrl}/sales/payments/${payment.id}`)
    if (!deleteRes.ok() && deleteRes.status() !== 404) {
      throw new Error(`No se pudo eliminar cobro ${payment.id}: ${deleteRes.status()} ${await deleteRes.text()}`)
    }
  }
}

async function findOpenInvoiceForContact(world: World, contactId: string): Promise<OpenInvoice> {
  const response = await world.page.request.get(
    `${world.apiUrl}/sales/invoices?contact_id=${contactId}&limit=50`,
  )
  const body = await response.json() as { data?: OpenInvoice[] }
  if (!response.ok() || !body.data) {
    throw new Error(`No se pudieron listar facturas del cliente: ${response.status()}`)
  }

  const invoice = body.data.find(
    (row) => ['issued', 'partially_paid'].includes(row.status) && Number(row.balance) > 0,
  )
  if (!invoice) {
    throw new Error('No hay factura con saldo pendiente para el cliente.')
  }
  return invoice
}

async function openCustomerAccountStatement(world: World, customerName: string): Promise<void> {
  await world.goto('/erp/sales/receivables')
  await world.page.getByTestId(TEST_IDS.accountStatementSearch).fill(customerName)
  await world.page.waitForTimeout(500)

  const detailPromise = world.page.waitForResponse(
    (r) => r.url().includes('/account-statement') && r.status() === 200,
  )

  await world.page.locator(
    `[data-testid="${TEST_IDS.accountStatementRow}"][data-customer-name="${customerName}"]`,
  ).click()

  await detailPromise
  await world.page.waitForURL(/contact_id=/, { timeout: 10000 })
}

async function assertPendingInvoicesFromSeed(world: World, dataTable: { hashes: () => Array<Record<string, string>> }): Promise<void> {
  const rows = dataTable.hashes()
  for (const row of rows) {
    const customerName = row.Cliente ?? row.cliente ?? ''
    const expectedAmount = Number(row.Monto ?? row.monto ?? 0)
    if (!customerName || !expectedAmount) continue

    const contact = await findContactInOrg(world, { name: customerName })
    let invoice = await findOpenInvoiceForContact(world, contact.id).catch(() => null)

    if (!invoice) {
      throw new Error(
        `Seed incompleto: ${customerName} no tiene factura pendiente. Ejecutá pnpm db:seed-dev.`,
      )
    }

    let balance = Number(invoice.balance)
    if (balance < expectedAmount) {
      await resetInvoicePayments(world, invoice.id)
      invoice = await findOpenInvoiceForContact(world, contact.id)
      balance = Number(invoice.balance)
    }

    if (balance < expectedAmount) {
      throw new Error(
        `Seed incompleto: ${customerName} debería tener deuda >= ${expectedAmount}, tiene ${balance}. Ejecutá pnpm db:seed-dev.`,
      )
    }
  }

  world.lastResult.pendingInvoices = rows
}

Given('existen facturas pendientes:', async function (this: World, dataTable) {
  await assertPendingInvoicesFromSeed(this, dataTable)
})

Given('hay situación patrimonial de integración para {string}', async function (this: World, period: string) {
  const { from, to } = parseAccountingPeriod(period)
  const response = await this.page.request.get(
    `${this.apiUrl}/accounting/reports/trial-balance?from=${from}&to=${to}`,
  )
  const body = await response.json() as { rows?: Array<{ type: string; saldo_debit: string; saldo_credit: string }> }
  if (!response.ok() || !body.rows?.length) {
    throw new Error(
      `Seed contable incompleto para ${period}. Ejecutá pnpm db:seed-integration-financials.`,
    )
  }

  const assets = body.rows
    .filter((row) => row.type === 'asset')
    .reduce((sum, row) => sum + Number(row.saldo_debit) - Number(row.saldo_credit), 0)

  if (assets < 250000) {
    throw new Error(
      `Seed contable incompleto: activos en ${period} deberían ser >= 250000, hay ${assets}. Ejecutá pnpm db:seed-integration-financials.`,
    )
  }
})

Given('hay al menos {int} clientes con saldo pendiente', async function (this: World, minCount: number) {
  const response = await this.page.request.get(
    `${this.apiUrl}/sales/account-statements?only_with_balance=true&limit=50`,
  )
  const body = await response.json() as { total?: number }
  if (!response.ok()) {
    throw new Error(`No se pudo listar cuentas por cobrar: ${response.status()}`)
  }

  const total = body.total ?? 0
  if (total < minCount) {
    throw new Error(
      `Seed incompleto: se esperaban al menos ${minCount} clientes con saldo, hay ${total}. Ejecutá pnpm db:seed-integration-financials.`,
    )
  }
})

Given('existem invoices pendientes:', async function (this: World, dataTable) {
  await assertPendingInvoicesFromSeed(this, dataTable)
})

When('navego a reportes financieros', async function (this: World) {
  await this.goto('/erp/accounting')
})

When('navego a cuentas por cobrar', async function (this: World) {
  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/sales/account-statements') && r.status() === 200,
  )
  await this.goto('/erp/sales/receivables')
  await responsePromise
  await expect(this.page.getByTestId(TEST_IDS.accountStatementSearch)).toBeVisible({ timeout: 10000 })
})

When('filtro clientes con saldo pendiente', async function (this: World) {
  const filter = this.page.getByTestId(TEST_IDS.accountStatementBalanceFilter)
  await expect(filter).toBeVisible({ timeout: 10000 })

  const currentValue = await filter.inputValue()
  if (currentValue === 'with_balance') {
    await expect(filter).toHaveValue('with_balance')
    return
  }

  const responsePromise = this.page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/sales/account-statements')
      && r.url().includes('only_with_balance=true')
      && r.status() === 200,
  )
  await filter.selectOption('with_balance')
  await responsePromise
})

When('consulto el estado de {string}', async function (this: World, customerName: string) {
  const contact = await findContactInOrg(this, { name: customerName })
  await this.goto('/erp/sales/receivables')

  await this.page.getByTestId(TEST_IDS.accountStatementSearch).fill(customerName)
  await this.page.waitForTimeout(500)

  const detailPromise = this.page.waitForResponse(
    (r) => r.url().includes('/account-statement') && r.status() === 200,
  )

  await this.page.locator(
    `[data-testid="${TEST_IDS.accountStatementRow}"][data-customer-name="${customerName}"]`,
  ).click()

  await detailPromise
  await this.page.waitForURL(/contact_id=/, { timeout: 10000 })

  this.testData.customer = {
    id: contact.id,
    name: customerName,
    cuit: contact.cuit ?? '',
  }
})

Then('veo deuda pendiente de {int}', async function (this: World, amount: number) {
  const debtElement = this.page.getByTestId(TEST_IDS.customerDebt)
  await expect(debtElement).toBeVisible()

  await expect.poll(async () => {
    const debtText = await debtElement.textContent()
    if (!debtText) return NaN
    return parseCurrency(debtText)
  }, { timeout: 10000 }).toBeCloseTo(amount, 2)
})

Then('veo vencimiento de factura {string}', async function (this: World, isoDate: string) {
  const dueDate = this.page.getByTestId(TEST_IDS.dueDate).first()
  await expect(dueDate).toBeVisible()

  // Match UI: new Date(isoDate).toLocaleDateString('es-AR') (UTC parse)
  const expected = new Date(isoDate).toLocaleDateString('es-AR')
  await expect(dueDate).toContainText(expected)
})

Then('el vencimiento fue hace {int} días', async function (this: World, days: number) {
  const dueDate = this.page.getByTestId(TEST_IDS.dueDate).first()
  await expect(dueDate).toBeVisible()
  const expected = new Date()
  expected.setDate(expected.getDate() - days)
  await expect(dueDate).toContainText(expected.toLocaleDateString('es-AR'))
})

Given('existe deuda de {int} pendiente de {string}', async function (this: World, amount: number, customerName: string) {
  const contact = await findContactInOrg(this, { name: customerName })
  let invoice = await findOpenInvoiceForContact(this, contact.id)
  let balance = Number(invoice.balance)

  if (balance < amount) {
    await resetInvoicePayments(this, invoice.id)
    invoice = await findOpenInvoiceForContact(this, contact.id)
    balance = Number(invoice.balance)
  }

  if (balance < amount) {
    throw new Error(
      `Seed incompleto: ${customerName} debería tener deuda >= ${amount}, tiene ${balance}. Ejecutá pnpm db:seed-dev.`,
    )
  }

  this.testData.customer = {
    id: contact.id,
    name: customerName,
    cuit: contact.cuit ?? '',
  }
  this.lastResult.invoiceId = invoice.id
  this.lastResult.debtAmount = amount
})

When('registro abono de {int}', async function (this: World, paymentAmount: number) {
  const invoiceId = this.lastResult.invoiceId as string | undefined
  if (!invoiceId) {
    throw new Error('No hay factura pendiente en contexto. Usá el Given de deuda primero.')
  }

  await this.goto(`/ventas/facturas/${invoiceId}`)
  await expect(this.page.getByTestId(TEST_IDS.invoiceBalance)).toBeVisible({ timeout: 10000 })

  const amountInput = this.page.getByTestId(TEST_IDS.paymentAmountInput)
  await amountInput.click()
  await amountInput.fill(paymentAmount.toFixed(2).replace('.', ','))

  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/sales/payments') && r.request().method() === 'POST',
  )
  await this.page.getByTestId(TEST_IDS.paymentSubmitBtn).click()
  const response = await responsePromise
  if (!response.ok()) {
    throw new Error(`Registrar cobro falló: ${response.status()} ${await response.text()}`)
  }

  await expectToast(this.page, 'Cobro registrado')
  this.lastResult.paymentAmount = paymentAmount
})

Then('la deuda disminuye a {int}', async function (this: World, expectedDebt: number) {
  const customerName = this.testData.customer?.name
  if (!customerName) throw new Error('No hay cliente en contexto')

  await openCustomerAccountStatement(this, customerName)

  const debtElement = this.page.getByTestId(TEST_IDS.customerDebt)
  await expect(debtElement).toBeVisible()

  await expect.poll(async () => {
    const debtText = await debtElement.textContent()
    if (!debtText) return NaN
    return parseCurrency(debtText)
  }, { timeout: 10000 }).toBeCloseTo(expectedDebt, 2)
})

Then('se registra en el diario contable', async function (this: World) {
  const customerName = this.testData.customer?.name
  const paymentAmount = this.lastResult.paymentAmount as number | undefined
  if (!customerName || paymentAmount === undefined) {
    throw new Error('Falta contexto de cliente o importe de cobro')
  }

  if (!this.page.url().includes('contact_id=')) {
    await openCustomerAccountStatement(this, customerName)
  }

  const movementRow = this.page.locator('table tbody tr').filter({
    has: this.page.locator(`[data-testid="${TEST_IDS.accountMovementRow}"][data-movement-type="payment"]`),
  })
  await expect(movementRow.first()).toBeVisible({ timeout: 10000 })
  await expect(movementRow.first()).toContainText('Cobro')
  await expect(movementRow.first()).toContainText('250,00')
})

When('genero reporte de deudas pendientes', async function (this: World) {
  if (!this.page.url().includes('/sales/receivables')) {
    await this.goto('/erp/sales/receivables')
  }

  const responsePromise = this.page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/sales/account-statements')
      && r.url().includes('only_with_balance=true')
      && r.status() === 200,
  )
  await this.page.getByTestId(TEST_IDS.accountStatementBalanceFilter).selectOption('with_balance')
  await responsePromise
})

async function assertReceivableCustomerCount(world: World, expectedCount: number): Promise<void> {
  const rows = world.page.getByTestId(TEST_IDS.accountStatementRow)
  await expect.poll(async () => rows.count(), { timeout: 10000 }).toBe(expectedCount)
}

Then('veo {int} clientes con deuda pendiente', async function (this: World, expectedCount: number) {
  await assertReceivableCustomerCount(this, expectedCount)
})

Then('el reporte muestra {int} deudas pendientes', async function (this: World, expectedCount: number) {
  await assertReceivableCustomerCount(this, expectedCount)
})

Then('veo columnas: {string}', async function (this: World, columns: string) {
  const expected = columns.split(',').map((column) => column.trim()).filter(Boolean)
  const headers = this.page.locator('table thead th')

  for (const column of expected) {
    await expect(headers.filter({ hasText: column }).first()).toBeVisible()
  }
})

When('consulto vencimiento de deudas de {string}', async function (this: World, customerName: string) {
  await this.goto('/erp/sales/receivables')

  await this.page.getByTestId(TEST_IDS.accountStatementSearch).fill(customerName)
  await this.page.waitForTimeout(500)

  await this.page.locator(
    `[data-testid="${TEST_IDS.accountStatementRow}"][data-customer-name="${customerName}"]`,
  ).click()

  await this.page.waitForURL(/contact_id=/, { timeout: 10000 })
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
  const contact = await findContactInOrg(this, { name: customerName })
  this.testData.customer = {
    id: contact.id,
    name: customerName,
    cuit: contact.cuit ?? '',
  }

  await openCustomerAccountStatement(this, customerName)
  await expect(this.page.getByTestId(TEST_IDS.customerDebt)).toBeVisible({ timeout: 10000 })
})

Then('el estado de cuenta contiene:', async function (this: World, dataTable) {
  const rows = dataTable.hashes()

  for (const row of rows) {
    const tipoLabel = row.tipo ?? row.Tipo ?? row.concepto ?? row.Concepto ?? ''
    const movementType = MOVEMENT_TYPE_BY_LABEL[tipoLabel]
    if (!movementType) {
      throw new Error(`Tipo de movimiento desconocido: ${tipoLabel}`)
    }

    const tableRow = movementTableRow(this, movementType)
    await expect(tableRow.first()).toBeVisible({ timeout: 10000 })

    const debe = row.debe ?? row.Debe
    if (debe) {
      await expect(tableRow.first()).toContainText(formatAmountForUi(Number(debe)))
    }

    const haber = row.haber ?? row.Haber
    if (haber) {
      await expect(tableRow.first()).toContainText(formatAmountForUi(Number(haber)))
    }
  }
})

When('consulto saldo de cuenta por período {string}', async function (this: World, period: string) {
  const { from, to } = parseAccountingPeriod(period)

  await this.goto('/erp/accounting/balance')
  await expect(this.page.getByTestId(TEST_IDS.trialBalanceFrom)).toBeVisible({ timeout: 10000 })

  const setDateInput = async (testId: string, value: string) => {
    const input = this.page.getByTestId(testId)
    await input.fill(value)
    await input.evaluate((element, nextValue) => {
      const dateInput = element as HTMLInputElement
      dateInput.value = nextValue
      dateInput.dispatchEvent(new Event('input', { bubbles: true }))
      dateInput.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  await setDateInput(TEST_IDS.trialBalanceFrom, from)
  await setDateInput(TEST_IDS.trialBalanceTo, to)

  await expect.poll(async () => {
    const summaryVisible = await this.page.getByTestId(TEST_IDS.totalAssets).isVisible()
    if (!summaryVisible) return 0
    const text = await this.page.getByTestId(TEST_IDS.totalAssets).textContent()
    if (!text) return 0
    return parseCurrency(text)
  }, { timeout: 15000 }).toBeGreaterThan(0)
})

Then('veo activos totales de {float}', async function (this: World, expectedTotal: number) {
  const assetsElement = this.page.getByTestId(TEST_IDS.totalAssets)
  const assetsText = await assetsElement.textContent()

  if (!assetsText) {
    throw new Error('Could not find assets total')
  }

  const actualAssets = parseCurrency(assetsText)
  expect(actualAssets).toBeCloseTo(expectedTotal, 2)
})

Then('veo pasivos totales de {float}', async function (this: World, expectedTotal: number) {
  const liabilitiesElement = this.page.getByTestId(TEST_IDS.totalLiabilities)
  const liabilitiesText = await liabilitiesElement.textContent()

  if (!liabilitiesText) {
    throw new Error('Could not find liabilities total')
  }

  const actualLiabilities = parseCurrency(liabilitiesText)
  expect(actualLiabilities).toBeCloseTo(expectedTotal, 2)
})

Then('el patrimonio neto es {float}', async function (this: World, expectedTotal: number) {
  const equityElement = this.page.getByTestId(TEST_IDS.netEquity)
  const equityText = await equityElement.textContent()

  if (!equityText) {
    throw new Error('No se encontró el patrimonio neto')
  }

  const actualEquity = parseCurrency(equityText)
  expect(actualEquity).toBeCloseTo(expectedTotal, 2)
})
