import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { TEST_PRODUCTS } from '../support/fixtures'

Given('existen productos en catálogo', async function (this: World) {
  // This would typically be seeded via API or database fixture
  this.testData.products = TEST_PRODUCTS
})

When('navego al catálogo de productos', async function (this: World) {
  await this.goto('/erp/catalog/products')
})

When('creo un producto con datos:', async function (this: World, dataTable) {
  await this.page.click('button:has-text("Nuevo Producto")')

  const data: Record<string, string> = {}
  dataTable.hashes().forEach((row) => {
    Object.assign(data, row)
  })

  await this.fillForm(data)

  await this.page.click('button:has-text("Guardar")')

  // Wait for success message
  await expect(this.page.locator('[role="status"]')).toContainText(/creado|guardado/i)
})

When('busco el producto {string}', async function (this: World, productName: string) {
  const searchInput = this.page.locator('input[placeholder*="search" i], input[placeholder*="buscar" i]')
  await searchInput.fill(productName)
  await this.page.waitForTimeout(500) // Wait for debounce
})

Then('veo el producto {string} en la lista', async function (this: World, productName: string) {
  const table = this.page.locator('table')
  await expect(table).toContainText(productName)
})

Then('no veo el producto {string}', async function (this: World, productName: string) {
  const table = this.page.locator('table')
  const count = await table.locator(`text=${productName}`).count()
  expect(count).toBe(0)
})

When('edito el producto {string}', async function (this: World, productName: string) {
  const row = this.page.locator(`table tr:has-text("${productName}")`)
  await row.locator('button[aria-label*="edit" i]').click()
})

When('establezco el precio de venta en {string}', async function (this: World, price: string) {
  const salePrice = this.page.locator('input[name="sale_price"], input[name="salePrice"]')
  await salePrice.fill(price)
})

When('establezco el precio de costo en {string}', async function (this: World, price: string) {
  const costPrice = this.page.locator('input[name="cost_price"], input[name="costPrice"]')
  await costPrice.fill(price)
})

When('archivar el producto {string}', async function (this: World, productName: string) {
  const row = this.page.locator(`table tr:has-text("${productName}")`)
  await row.locator('button[aria-label*="delete" i]').click()

  // Confirm deletion
  const confirmBtn = this.page.locator('button:has-text("Confirmar")')
  await confirmBtn.click()
})

Then('el producto {string} está archivado', async function (this: World, productName: string) {
  // Check if product appears in archived list or with archived badge
  const table = this.page.locator('table')
  const row = table.locator(`tr:has-text("${productName}")`)

  // Look for archived indicator
  const archivedBadge = row.locator('[data-testid="archived-badge"]')
  await expect(archivedBadge).toBeVisible()
})

When('filtro productos por categoría {string}', async function (this: World, category: string) {
  const categoryFilter = this.page.locator('select[name="category"]')
  await categoryFilter.selectOption(category)
})

Then('veo solo productos de la categoría {string}', async function (this: World, category: string) {
  const rows = this.page.locator('table tbody tr')
  const count = await rows.count()

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    const categoryCell = row.locator('td:nth-child(3)') // Adjust column number as needed
    await expect(categoryCell).toContainText(category)
  }
})

When('establezco una lista de precios {string} con:', async function (this: World, priceListName: string, dataTable) {
  // Navigate to price list page
  await this.goto('/erp/catalog/price-lists')

  // Create new price list
  await this.page.click('button:has-text("Nueva Lista")')

  // Fill name
  await this.page.fill('input[name="name"]', priceListName)

  // Add products
  const rows = dataTable.hashes()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const productInput = this.page.locator(`input[name="products[${i}].code"]`)
    const priceInput = this.page.locator(`input[name="products[${i}].price"]`)

    await productInput.fill(row.producto)
    await priceInput.fill(row.precio)
  }

  await this.page.click('button:has-text("Guardar")')
})

Then('la lista de precios {string} existe', async function (this: World, priceListName: string) {
  const table = this.page.locator('table')
  await expect(table).toContainText(priceListName)
})
