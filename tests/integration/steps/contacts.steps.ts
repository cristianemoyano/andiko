import { Given, When, Then, type DataTable } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { findContactInOrg } from '../support/org-context'
import { resetIntegrationSupplierLedger } from '../support/integration-catalog'
import { byTestId, byTestIdAttr, desktopTableTestIdAttr } from '../support/locators'
import { generateTestId } from '../support/fixtures'
import { INTEGRATION_SUPPLIERS } from '@/db/dev/integration-seed-data'
import { TEST_IDS } from '../support/test-ids'
import { formatCuit, validateCuit } from '@/modules/contacts/contact.utils'
import { expectToast } from '../support/toast'

function requireAuthenticated(world: World): void {
  if (!world.testData.user) {
    throw new Error(
      'Este paso requiere sesión con org (usá "estoy autenticado como ..." antes).',
    )
  }
}

function parseFieldValueTable(dataTable: DataTable): Record<string, string> {
  const row: Record<string, string> = {}
  for (const line of dataTable.raw()) {
    if (line.length >= 2) {
      row[line[0].trim()] = line[1].trim()
    }
  }
  return row
}

function mapContactFormFields(row: Record<string, string>, suffix: string): Record<string, string> {
  const baseName = row.nombre ?? row.name ?? row.legal_name ?? ''
  const emailBase = row.email ?? ''
  const uniqueEmail = emailBase.includes('@')
    ? emailBase.replace('@', `+${suffix}@`)
    : `${suffix}@test.local`
  return {
    legal_name: baseName ? `${baseName} ${suffix}` : suffix,
    email: uniqueEmail,
    phone: row.telefono ?? row.phone ?? '',
  }
}

Given('existe un proveedor {string} con CUIT {string}', async function (this: World, name: string, cuit: string) {
  requireAuthenticated(this)
  if (INTEGRATION_SUPPLIERS.some((s) => s.legal_name === name)) {
    await resetIntegrationSupplierLedger(name)
  }
  const contact = await findContactInOrg(this, { name, cuit })
  this.testData.supplier = { id: contact.id, name, cuit }
})

Given('existe un cliente {string} con CUIT {string}', async function (this: World, name: string, cuit: string) {
  requireAuthenticated(this)
  const contact = await findContactInOrg(this, { name, cuit })
  this.testData.customer = { id: contact.id, name, cuit }
})

Given('existen proveedores:', async function (this: World, dataTable) {
  const suppliers = dataTable.hashes()
  console.log('Suppliers to seed:', suppliers)
})

When('navego a contactos', async function (this: World) {
  await this.goto('/erp/contacts')
})

When('creo un nuevo contacto proveedor con:', async function (this: World, dataTable: DataTable) {
  await byTestId(this.page, TEST_IDS.newContactBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.contactModal)).toBeVisible()

  const row = parseFieldValueTable(dataTable)
  const suffix = generateTestId('e2e')
  const data = mapContactFormFields(row, suffix)
  this.testData.createdContactName = data.legal_name

  await this.page.selectOption('select[name="type"]', 'supplier')
  await this.fillForm(data)

  this.testData.supplier = {
    name: data.legal_name ?? this.testData.supplier?.name ?? '',
    cuit: row.cuit ?? this.testData.supplier?.cuit ?? '',
  }

  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/contacts') && r.request().method() === 'POST',
  )
  await this.page.getByTestId(TEST_IDS.contactSaveBtn).click()
  const response = await responsePromise
  if (!response.ok()) {
    throw new Error(`Crear proveedor falló: ${response.status()} ${await response.text()}`)
  }
  await expectToast(this.page, 'Contacto creado')
  await expect(this.page.getByTestId(TEST_IDS.contactModal)).not.toBeVisible({ timeout: 10000 })
})

When('creo un nuevo contacto cliente con:', async function (this: World, dataTable: DataTable) {
  await byTestId(this.page, TEST_IDS.newContactBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.contactModal)).toBeVisible()

  const row = parseFieldValueTable(dataTable)
  const suffix = generateTestId('e2e')
  const data = mapContactFormFields(row, suffix)
  this.testData.createdContactName = data.legal_name

  await this.page.selectOption('select[name="type"]', 'customer')
  await this.fillForm(data)

  this.testData.customer = {
    name: data.legal_name ?? this.testData.customer?.name ?? '',
    cuit: row.cuit ?? this.testData.customer?.cuit ?? '',
  }

  const hasSaveFields = Boolean(row.cuit || row.email || row.telefono || row.phone)
  if (hasSaveFields) {
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/v1/contacts') && r.request().method() === 'POST',
    )
    await this.page.getByTestId(TEST_IDS.contactSaveBtn).click()
    const response = await responsePromise
    if (!response.ok()) {
      throw new Error(`Crear cliente falló: ${response.status()} ${await response.text()}`)
    }
    await expectToast(this.page, 'Contacto creado')
    await expect(this.page.getByTestId(TEST_IDS.contactModal)).not.toBeVisible({ timeout: 10000 })
  }
})

When('busco el contacto {string}', async function (this: World, contactName: string) {
  await this.page.getByTestId(TEST_IDS.contactSearch).fill(contactName)
  await this.page.waitForTimeout(500)
})

Then('veo el contacto {string}', async function (this: World, contactName: string) {
  const name = contactName === 'el creado' && this.testData.createdContactName
    ? this.testData.createdContactName
    : contactName
  const row = desktopTableTestIdAttr(this.page, TEST_IDS.contactRow, { 'contact-name': name })
  await expect(row).toBeVisible()
})

Then('veo el contacto creado', async function (this: World) {
  const name = this.testData.createdContactName
  if (!name) throw new Error('No hay contacto creado en testData')
  await this.page.getByTestId(TEST_IDS.contactSearch).fill(name)
  await this.page.waitForTimeout(500)
  const row = desktopTableTestIdAttr(this.page, TEST_IDS.contactRow, { 'contact-name': name })
  await expect(row).toBeVisible()
})

When('edito el contacto {string}', async function (this: World, contactName: string) {
  await this.page.getByTestId(TEST_IDS.contactSearch).fill(contactName)
  await this.page.waitForTimeout(500)
  const row = this.page.getByRole('row').filter({ hasText: contactName }).first()
  await row.getByRole('button', { name: 'Más acciones' }).click()
  await byTestIdAttr(this.page, TEST_IDS.editContactBtn, { 'contact-name': contactName }).click()
  await expect(this.page.getByTestId(TEST_IDS.contactModal)).toBeVisible()
})

When('guardo el contacto', async function (this: World) {
  const cuitInput = this.page.locator('input[name="cuit"]')
  const rawCuit = await cuitInput.inputValue()
  if (rawCuit.trim()) {
    if (validateCuit(rawCuit)) {
      await cuitInput.fill(formatCuit(rawCuit))
    } else {
      await cuitInput.clear()
    }
  }

  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/contacts') && ['POST', 'PATCH'].includes(r.request().method()),
  )
  await this.page.getByTestId(TEST_IDS.contactSaveBtn).click()
  const response = await responsePromise
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Guardar contacto falló: ${response.status()} ${body}`)
  }
  await expect(this.page.getByTestId(TEST_IDS.contactModal)).not.toBeVisible({ timeout: 10000 })
})

When('abro el detalle del contacto {string}', async function (this: World, contactName: string) {
  requireAuthenticated(this)
  const contact = await findContactInOrg(this, { name: contactName })
  await this.goto(`/contactos/${contact.id}`)
})

When('actualizo el nombre a {string}', async function (this: World, newName: string) {
  await this.page.locator('input[name="legal_name"]').clear()
  await this.page.locator('input[name="legal_name"]').fill(newName)
})

When('actualizo el email a {string}', async function (this: World, email: string) {
  const suffix = generateTestId('e2e')
  const uniqueEmail = email.includes('@') ? email.replace('@', `+${suffix}@`) : `${suffix}@test.local`
  const emailInput = this.page.locator('input[name="email"]')
  await emailInput.clear()
  await emailInput.fill(uniqueEmail)
})

When('actualizo el teléfono a {string}', async function (this: World, phone: string) {
  const phoneInput = this.page.locator('input[name="phone"]')
  await phoneInput.clear()
  await phoneInput.fill(phone)
})

When('ingreso CUIT inválido {string}', async function (this: World, cuit: string) {
  const cuitInput = this.page.locator('input[name="cuit"]')
  await cuitInput.fill(cuit)
  await cuitInput.blur()
  await this.page.getByTestId(TEST_IDS.contactSaveBtn).click()
})

Then('el validador rechaza CUIT inválido {string}', async function (this: World, cuit: string) {
  await expect(this.page.getByTestId(TEST_IDS.cuitError)).toBeVisible()
  await expect(this.page.locator('input[name="cuit"]')).toHaveValue(cuit)
})

When('establezco CBU {string}', async function (this: World, cbu: string) {
  const suffix = generateTestId('cbu').replace(/\D/g, '').slice(-8).padStart(8, '0')
  const uniqueCbu = `${cbu.slice(0, 14)}${suffix}`.slice(0, 22)

  await this.page.getByTestId(TEST_IDS.paymentInfoAddBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.paymentInfoModal)).toBeVisible()
  await this.page.getByTestId(TEST_IDS.paymentInfoModal).locator('input[name="cbu"]').fill(uniqueCbu)

  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/payment-info') && r.request().method() === 'POST',
  )
  await this.page.getByTestId(TEST_IDS.paymentInfoSaveBtn).click()
  const response = await responsePromise
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Guardar CBU falló: ${response.status()} ${body}`)
  }
  await expect(this.page.getByTestId(TEST_IDS.paymentInfoModal)).not.toBeVisible({ timeout: 10000 })
})

Then('el CBU es validado correctamente', async function (this: World) {
  await expect(this.page.getByTestId(TEST_IDS.cbuError)).not.toBeVisible()
})

When('filtro contactos por tipo {string}', async function (this: World, type: string) {
  const value = type === 'proveedor' ? 'supplier' : type === 'cliente' ? 'customer' : type

  const responsePromise = this.page.waitForResponse(
    (r) => r.url().includes('/api/v1/contacts') && r.url().includes(`type=${value}`),
  )
  await this.page.getByTestId(TEST_IDS.contactTypeFilter).selectOption(value)
  await responsePromise
})

Then('veo solo contactos de tipo {string}', async function (this: World, type: string) {
  const expectedType = type === 'proveedor' ? 'supplier' : type === 'cliente' ? 'customer' : type
  const typeCells = this.page.locator(
    `[data-testid="${TEST_IDS.contactTypeCell}"][data-contact-type="${expectedType}"]`,
  )

  await expect(typeCells.first()).toBeVisible({ timeout: 10000 })

  const count = await typeCells.count()
  expect(count).toBeGreaterThan(0)

  const allTypeCells = this.page.locator(`[data-testid="${TEST_IDS.contactTypeCell}"]`)
  await expect(allTypeCells).toHaveCount(count)
})
