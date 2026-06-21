import { Given, When, Then, Before, type DataTable } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { TEST_USERS } from '../support/fixtures'
import { TEST_IDS } from '../support/test-ids'
import { expectToast } from '../support/toast'

Given('estoy autenticado como {string}', async function (this: World, role: string) {
  const user = TEST_USERS[role as keyof typeof TEST_USERS]
  if (!user) {
    throw new Error(`Unknown role: ${role}`)
  }

  this.testData.user = user
  await this.login(user.email, user.password)

  // Verify we're logged in (check for dashboard or sidebar)
  await expect(this.page.getByTestId(TEST_IDS.sidebar)).toBeVisible({ timeout: 10000 })
})

When('navego a {string}', async function (this: World, path: string) {
  await this.goto(path)
})

When('espero {int} segundos', async function (this: World, seconds: number) {
  await this.page.waitForTimeout(seconds * 1000)
})

When('hago clic en {string} en el diálogo', async function (this: World, label: string) {
  const dialog = this.page.getByTestId(TEST_IDS.confirmDialog)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: new RegExp(label, 'i') }).click()
})

When('hago clic en {string}', async function (this: World, selector: string) {
  const isCss = /^(#|\[|\.)/.test(selector)
  const element = isCss
    ? this.page.locator(selector)
    : this.page.getByRole('button', { name: new RegExp(selector, 'i') })
  await expect(element.first()).toBeVisible()
  await element.first().click()
})

When('completo el formulario con:', async function (this: World, dataTable: DataTable) {
  const data: Record<string, string> = {}
  dataTable.hashes().forEach((row: Record<string, string>) => {
    Object.assign(data, row)
  })

  await this.fillForm(data)
})

When('ingreso {string} en el campo {string}', async function (this: World, value: string, fieldLabel: string) {
  // Find input by label or name
  const input = this.page.locator(`input[name="${fieldLabel}"], input[aria-label="${fieldLabel}"]`)
  await expect(input).toBeVisible()
  await input.fill(value)
})

When('selecciono {string} de {string}', async function (this: World, option: string, fieldLabel: string) {
  const select = this.page.locator(`select[name="${fieldLabel}"]`)
  await expect(select).toBeVisible()
  await select.selectOption(option)
})

When('presiono Enter', async function (this: World) {
  await this.page.press('body', 'Enter')
})

When('presiono Escape', async function (this: World) {
  await this.page.press('body', 'Escape')
})

Then('veo el título {string}', async function (this: World, title: string) {
  const heading = this.page.locator(`h1, h2, h3`)
  await expect(heading).toContainText(title, { ignoreCase: true })
})

Then('veo el mensaje {string}', async function (this: World, message: string) {
  await expectToast(this.page, message)
})

Then('veo error {string}', async function (this: World, errorText: string) {
  const errorEl = this.page.locator('[role="alert"]').first()
  await expect(errorEl).toBeVisible({ timeout: 10000 })
  await expect(errorEl).toContainText(errorText)
})

Then('el elemento {string} es visible', async function (this: World, selector: string) {
  await expect(this.page.locator(selector)).toBeVisible()
})

Then('el elemento {string} no es visible', async function (this: World, selector: string) {
  await expect(this.page.locator(selector)).not.toBeVisible()
})

Then('el elemento {string} contiene {string}', async function (this: World, selector: string, text: string) {
  await expect(this.page.locator(selector)).toContainText(text)
})

Then('veo {int} fila(s) en la tabla', async function (this: World, count: number) {
  const rows = this.page.locator('table tbody tr')
  await expect(rows).toHaveCount(count)
})

Then('la tabla contiene {string}', async function (this: World, text: string) {
  const table = this.page.locator('table')
  await expect(table).toContainText(text)
})

Then('la URL contiene {string}', async function (this: World, path: string) {
  await expect(this.page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')))
})

Then('la URL no contiene {string}', async function (this: World, path: string) {
  const url = this.page.url()
  expect(url).not.toContain(path)
})

Before(function (this: World) {
  // Reset test data before each scenario
  this.testData = {}
  this.lastResult = {}
})
