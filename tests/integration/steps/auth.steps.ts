import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'
import { isAuthenticatedAppPath } from '../support/routes'
import { TEST_IDS } from '../support/test-ids'

When('voy a la página de login', async function (this: World) {
  await this.goto('/login')
  await expect(this.page.getByTestId(TEST_IDS.loginEmail)).toBeVisible()
})

When('ingreso las credenciales {string} y {string}', async function (this: World, email: string, password: string) {
  await this.page.getByTestId(TEST_IDS.loginEmail).fill(email)
  await this.page.getByTestId(TEST_IDS.loginPassword).fill(password)
})

When('hago clic en login', async function (this: World) {
  await this.page.getByTestId(TEST_IDS.loginSubmit).click()
})

Then('soy redireccionado al dashboard', async function (this: World) {
  await this.page.waitForURL(
    (url) => isAuthenticatedAppPath(url.pathname),
    { timeout: 10000 },
  )
  await expect(this.page.getByTestId(TEST_IDS.sidebar)).toBeVisible()
  const contactsProbe = await this.page.request.get(`${this.apiUrl}/contacts?limit=1`)
  expect(contactsProbe.ok(), 'sesión sin organización (revisá pnpm db:seed-dev)').toBeTruthy()
})

Then('veo el error de autenticación {string}', async function (this: World, errorMessage: string) {
  await expect(this.page.getByTestId(TEST_IDS.loginError)).toContainText(errorMessage)
})

Then('permanezco en la página de login', async function (this: World) {
  await expect(this.page).toHaveURL(/\/login/)
})

When('hago logout', async function (this: World) {
  await this.logout()
})

Then('soy redireccionado a login', async function (this: World) {
  await this.page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 })
})

When('intento acceder a {string} sin autenticación', async function (this: World, path: string) {
  await this.goto(path)
})

Then('soy redireccionado a login automáticamente', async function (this: World) {
  await expect(this.page).toHaveURL(/\/login/, { timeout: 5000 })
})

When('dejo la sesión inactiva por {int} minutos', async function (this: World, minutes: number) {
  await this.page.waitForTimeout(minutes * 60 * 1000)
})

Then('la sesión expira automáticamente', async function (this: World) {
  try {
    await this.page.getByTestId(TEST_IDS.sidebar).click()
  } catch {
    // Expected to fail
  }

  await expect(this.page).toHaveURL(/\/login/, { timeout: 5000 })
})
