import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'

Given('existe un proveedor {string} con CUIT {string}', async function (this: World, name: string, cuit: string) {
  // Would be seeded via API or database
  this.testData.supplier = {
    name,
    cuit,
  }
})

Given('existe un cliente {string} con CUIT {string}', async function (this: World, name: string, cuit: string) {
  this.testData.customer = {
    name,
    cuit,
  }
})

Given('existen proveedores:', async function (this: World, dataTable) {
  const suppliers = dataTable.hashes()
  // Would seed these via API
  console.log('Suppliers to seed:', suppliers)
})

When('navego a contactos', async function (this: World) {
  await this.goto('/erp/contacts')
})

When('creo un nuevo contacto proveedor con:', async function (this: World, dataTable) {
  await this.page.click('button:has-text("Nuevo Contacto")')

  const data: Record<string, string> = {}
  dataTable.hashes().forEach((row) => {
    Object.assign(data, row)
  })

  // Select "Proveedor" type
  await this.page.selectOption('select[name="type"]', 'supplier')

  await this.fillForm(data)

  // Store for later use
  this.testData.supplier = {
    ...this.testData.supplier,
    ...data,
  }

  await this.page.click('button:has-text("Guardar")')

  await expect(this.page.locator('[role="status"]')).toContainText(/creado|guardado/i)
})

When('creo un nuevo contacto cliente con:', async function (this: World, dataTable) {
  await this.page.click('button:has-text("Nuevo Contacto")')

  const data: Record<string, string> = {}
  dataTable.hashes().forEach((row) => {
    Object.assign(data, row)
  })

  // Select "Cliente" type
  await this.page.selectOption('select[name="type"]', 'customer')

  await this.fillForm(data)

  // Store for later use
  this.testData.customer = {
    ...this.testData.customer,
    ...data,
  }

  await this.page.click('button:has-text("Guardar")')

  await expect(this.page.locator('[role="status"]')).toContainText(/creado|guardado/i)
})

When('busco el contacto {string}', async function (this: World, contactName: string) {
  const searchInput = this.page.locator('input[placeholder*="search" i], input[placeholder*="buscar" i]')
  await searchInput.fill(contactName)
  await this.page.waitForTimeout(500)
})

Then('veo el contacto {string}', async function (this: World, contactName: string) {
  const table = this.page.locator('table')
  await expect(table).toContainText(contactName)
})

When('edito el contacto {string}', async function (this: World, contactName: string) {
  const row = this.page.locator(`table tr:has-text("${contactName}")`)
  await row.locator('button[aria-label*="edit" i]').click()
})

When('actualizo el nombre a {string}', async function (this: World, newName: string) {
  const nameInput = this.page.locator('input[name="name"]')
  await nameInput.clear()
  await nameInput.fill(newName)
})

When('actualizo el email a {string}', async function (this: World, email: string) {
  const emailInput = this.page.locator('input[name="email"]')
  await emailInput.clear()
  await emailInput.fill(email)
})

When('actualizo el teléfono a {string}', async function (this: World, phone: string) {
  const phoneInput = this.page.locator('input[name="phone"]')
  await phoneInput.clear()
  await phoneInput.fill(phone)
})

Then('el validador rechaza CUIT inválido {string}', async function (this: World, cuit: string) {
  const cuitInput = this.page.locator('input[name="cuit"]')
  await cuitInput.fill(cuit)

  const errorMessage = this.page.locator('[data-testid="cuit-error"]')
  await expect(errorMessage).toBeVisible()
})

When('establezco CBU {string}', async function (this: World, cbu: string) {
  const cbuInput = this.page.locator('input[name="cbu"]')
  await cbuInput.fill(cbu)
})

Then('el CBU es validado correctamente', async function (this: World) {
  const errorMessage = this.page.locator('[data-testid="cbu-error"]')
  await expect(errorMessage).not.toBeVisible()
})

When('filtro contactos por tipo {string}', async function (this: World, type: string) {
  const typeSelect = this.page.locator('select[name="contact_type"]')
  await typeSelect.selectOption(type === 'proveedor' ? 'supplier' : 'customer')
})

Then('veo solo contactos de tipo {string}', async function (this: World, type: string) {
  const table = this.page.locator('table')
  const rows = table.locator('tbody tr')

  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i)
    const typeCell = row.locator('td:nth-child(2)') // Adjust column as needed
    const expectedType = type === 'proveedor' ? 'Proveedor' : 'Cliente'
    await expect(typeCell).toContainText(expectedType)
  }
})
