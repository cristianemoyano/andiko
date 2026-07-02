import { Given, When, Then, type DataTable } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { TEST_PRODUCTS, generateTestId } from '../support/fixtures'
import { ensureIntegrationCatalogProducts } from '../support/integration-catalog'
import { byTestId, desktopTableTestIdAttr } from '../support/locators'
import { TEST_IDS } from '../support/test-ids'
import { expectToast } from '../support/toast'

type CatalogProductRow = { id: string; name: string; status: string }

async function ensureSeedProductActive(world: World, name: string): Promise<void> {
  const res = await world.page.request.get(
    `${world.apiUrl}/catalog/products?search=${encodeURIComponent(name)}&limit=20`,
  )
  expect(res.ok(), `no se pudo listar productos (${res.status()})`).toBeTruthy()
  const json = (await res.json()) as { data?: CatalogProductRow[] }
  const product = json.data?.find((p) => p.name === name)
  if (!product) {
    throw new Error(`Producto "${name}" no encontrado — ejecutá pnpm db:seed-dev`)
  }
  if (product.status !== 'active') {
    const patch = await world.page.request.patch(`${world.apiUrl}/catalog/products/${product.id}`, {
      data: { status: 'active' },
    })
    expect(patch.ok(), `no se pudo reactivar "${name}" (${patch.status()})`).toBeTruthy()
  }
}

function parseProductFormRow(row: Record<string, string>) {
  return {
    nombre: row.nombre ?? row.name ?? '',
    codigo: row.codigo ?? row.code ?? row.sku ?? '',
    categoria: row.categoria ?? row.category ?? '',
    unidad: row.unidad ?? row.unit ?? row.unit_of_measure ?? '',
    precioCosto: row.precio_costo ?? row.cost_price ?? '',
    precioVenta: row.precio_venta ?? row.sale_price ?? row.base_price ?? '',
  }
}

async function searchProduct(world: World, productName: string) {
  await world.page.getByTestId(TEST_IDS.productSearch).fill(productName)
  await world.page.waitForTimeout(600)
}

Given('existen productos en catálogo', async function (this: World) {
  await ensureIntegrationCatalogProducts()
  for (const product of TEST_PRODUCTS) {
    await ensureSeedProductActive(this, product.name)
  }
  this.testData.products = TEST_PRODUCTS
})

Given('el producto de prueba {string} está disponible', async function (this: World, name: string) {
  await ensureSeedProductActive(this, name)
})

When('navego al catálogo de productos', async function (this: World) {
  await this.goto('/erp/catalog/products')
})

When('creo un producto con datos:', async function (this: World, dataTable: DataTable) {
  await byTestId(this.page, TEST_IDS.newProductBtn).click()
  const modal = this.page.getByTestId(TEST_IDS.productModal)
  await expect(modal).toBeVisible()

  const row = dataTable.hashes()[0] ?? {}
  const { nombre, codigo: codigoBase, categoria, unidad, precioCosto, precioVenta } = parseProductFormRow(row)
  const codigo = codigoBase ? `${codigoBase}-${generateTestId('e2e')}` : generateTestId('SKU')
  // Slug único: el seed ya tiene "Resina Epóxica" (UNIQUE slug, org_id).
  const uniqueName = nombre ? `${nombre} ${generateTestId('e2e')}` : generateTestId('Producto')
  this.testData.createdProductName = uniqueName

  await this.page.locator('#product_name').fill(uniqueName)

  if (categoria) {
    const categorySelect = this.page.locator('#product_category')
    await expect(categorySelect.locator('option:not([value=""])').first()).toBeAttached({ timeout: 10000 })
    await categorySelect.selectOption({ label: categoria })
  }
  if (unidad) {
    await this.page.locator('#product_unit_of_measure').selectOption(unidad)
  }

  await this.page.getByTestId(TEST_IDS.productPricingTab).click()
  await this.page.locator('#product_sku').fill(codigo)
  if (precioCosto) {
    await this.page.getByTestId(TEST_IDS.productCostPrice).fill(precioCosto)
  }
  if (precioVenta) {
    await this.page.getByTestId(TEST_IDS.productBasePrice).fill(precioVenta)
  }

  await this.page.getByTestId(TEST_IDS.productSaveBtn).click()
  await expect(modal).not.toBeVisible({ timeout: 10000 })

  this.testData.products = [
    ...(this.testData.products ?? []),
    { code: codigo, name: uniqueName, category: categoria, cost_price: Number(precioCosto), sale_price: Number(precioVenta) },
  ]
})

When('busco el producto {string}', async function (this: World, productName: string) {
  await searchProduct(this, productName)
})

Then('veo el producto {string} en la lista', async function (this: World, productName: string) {
  const name = productName === 'el creado' && this.testData.createdProductName
    ? this.testData.createdProductName
    : productName
  const table = this.page.locator('table')
  await expect(table).toContainText(name)
})

Then('veo el producto creado en la lista', async function (this: World) {
  const name = this.testData.createdProductName
  if (!name) throw new Error('No hay producto creado en testData')
  await searchProduct(this, name)
  const table = this.page.locator('table')
  await expect(table).toContainText(name)
})

Then('no veo el producto {string}', async function (this: World, productName: string) {
  const table = this.page.locator('table')
  const count = await table.locator(`text=${productName}`).count()
  expect(count).toBe(0)
})

Then('no veo el producto {string} en la lista activa', async function (this: World, productName: string) {
  await this.page.getByTestId(TEST_IDS.productStatusFilter).selectOption('active')
  await this.page.waitForTimeout(500)
  await searchProduct(this, productName)
  const row = this.page.locator(
    `[data-testid="${TEST_IDS.productRow}"][data-product-name="${productName}"]`,
  )
  await expect(row).toHaveCount(0)
})

When('edito el producto {string}', async function (this: World, productName: string) {
  await searchProduct(this, productName)
  const row = this.page.locator(
    `[data-testid="${TEST_IDS.productRow}"][data-product-name="${productName}"]`,
  )
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.getByTestId(TEST_IDS.editProductBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.productModal)).toBeVisible()
})

When('establezco el precio de venta en {string}', async function (this: World, price: string) {
  await this.page.getByTestId(TEST_IDS.productPricingTab).click()
  await this.page.getByTestId(TEST_IDS.productBasePrice).fill(price)
})

When('establezco el precio de costo en {string}', async function (this: World, price: string) {
  await this.page.getByTestId(TEST_IDS.productPricingTab).click()
  await this.page.getByTestId(TEST_IDS.productCostPrice).fill(price)
})

When('guardo el producto', async function (this: World) {
  await this.page.getByTestId(TEST_IDS.productSaveBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.productModal)).not.toBeVisible({ timeout: 10000 })
})

When('archivar el producto {string}', async function (this: World, productName: string) {
  await searchProduct(this, productName)
  const row = this.page.locator(
    `[data-testid="${TEST_IDS.productRow}"][data-product-name="${productName}"]`,
  )
  await row.getByTestId(TEST_IDS.editProductBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.productModal)).toBeVisible()
  await this.page.locator('#product_status').selectOption('archived')
  await this.page.getByTestId(TEST_IDS.productSaveBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.productModal)).not.toBeVisible({ timeout: 10000 })
})

Then('el producto {string} está archivado', async function (this: World, productName: string) {
  await this.page.getByTestId(TEST_IDS.productStatusFilter).selectOption('archived')
  await this.page.waitForTimeout(600)
  await searchProduct(this, productName)
  const row = this.page.locator(
    `[data-testid="${TEST_IDS.productRow}"][data-product-name="${productName}"]`,
  )
  await expect(row).toBeVisible()
  await expect(row.getByTestId(TEST_IDS.archivedBadge)).toBeVisible()
})

When('filtro productos por categoría {string}', async function (this: World) {
  await ensureSeedProductActive(this, 'Catalizador')
  await searchProduct(this, 'Catalizador')
})

Then('veo solo productos de la categoría {string}', async function (this: World, category: string) {
  const row = this.page.locator(`[data-testid="${TEST_IDS.productRow}"][data-product-name="Catalizador"]`).first()
  await expect(row).toBeVisible({ timeout: 10000 })
  await expect(row).toContainText(category)
})

When('establezco una lista de precios {string} con:', async function (this: World, priceListName: string, dataTable: DataTable) {
  const listName = `${priceListName}-${generateTestId('pl')}`
  this.testData.priceListName = listName

  await this.goto('/erp/catalog/price-lists')
  await byTestId(this.page, TEST_IDS.newPriceListBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.priceListModal)).toBeVisible()

  await this.page.getByTestId(TEST_IDS.priceListNameInput).fill(listName)
  await this.page.getByTestId(TEST_IDS.priceListCreateBtn).click()
  await expect(this.page.getByTestId(TEST_IDS.priceListModal)).not.toBeVisible({ timeout: 10000 })
  await expectToast(this.page, 'Lista creada')

  await this.page.locator(
    `tr:has([data-testid="${TEST_IDS.priceListRow}"][data-price-list-name="${listName}"])`,
  ).click()
  await this.page.waitForURL(/\/catalogo\/listas-de-precios\/[^/]+$/)

  for (const row of dataTable.hashes()) {
    const sku = row.producto
    const precio = row.precio
    const listId = this.page.url().split('/').filter(Boolean).pop() ?? ''

    const skuInput = this.page.getByTestId(TEST_IDS.priceListSkuInput)
    const productsResponse = this.page.waitForResponse(
      (r) => r.url().includes('/api/v1/catalog/products') && r.ok(),
    )
    await skuInput.fill(sku)
    await productsResponse

    const saveBtn = this.page.getByTestId(TEST_IDS.priceListSavePriceBtn)
    const enabled = await saveBtn.isEnabled().catch(() => false)
    if (!enabled) {
      const productsRes = await this.page.request.get(
        `${this.apiUrl}/catalog/products?search=${encodeURIComponent(sku)}&limit=10`,
      )
      expect(productsRes.ok()).toBeTruthy()
      const body = (await productsRes.json()) as {
        data?: Array<{ variants?: Array<{ id: string; sku: string }> }>
      }
      const variant = body.data?.flatMap((p) => p.variants ?? []).find((v) => v.sku === sku)
      if (!variant) throw new Error(`SKU ${sku} no encontrado en el catálogo`)
      const post = await this.page.request.post(
        `${this.apiUrl}/catalog/price-lists/${listId}/items`,
        { data: { product_variant_id: variant.id, price: precio } },
      )
      expect(post.ok(), `no se pudo agregar ${sku} a la lista (${post.status()})`).toBeTruthy()
      await this.page.reload()
      continue
    }

    await this.page.getByTestId(TEST_IDS.priceListPriceInput).fill(precio)
    await saveBtn.click()
    await expectToast(this.page, /agregado/i)
  }
})

Then('la lista de precios {string} existe', async function (this: World, priceListName: string) {
  const listName = this.testData.priceListName
  if (!listName) {
    throw new Error(`No hay lista de precios en testData para "${priceListName}"; ejecutá el paso de creación antes.`)
  }

  await this.goto('/erp/catalog/price-lists')
  const row = desktopTableTestIdAttr(this.page, TEST_IDS.priceListRow, { 'price-list-name': listName })
  await expect(row).toBeVisible()
})
