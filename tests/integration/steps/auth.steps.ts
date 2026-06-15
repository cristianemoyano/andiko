import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { World } from '../support/world'

When('voy a la página de login', async function (this: World) {
  await this.goto('/login')
  await expect(this.page.locator('input[type="email"]')).toBeVisible()
})

When('ingreso las credenciales {string} y {string}', async function (this: World, email: string, password: string) {
  await this.page.fill('input[type="email"]', email)
  await this.page.fill('input[type="password"]', password)
})

When('hago clic en login', async function (this: World) {
  await this.page.click('button[type="submit"]')
})

Then('soy redireccionado al dashboard', async function (this: World) {
  await this.page.waitForURL((url) => url.pathname.includes('/erp'), { timeout: 10000 })
  await expect(this.page.locator('[data-testid="sidebar"]')).toBeVisible()
})

Then('veo el error de autenticación {string}', async function (this: World, errorMessage: string) {
  const error = this.page.locator('[role="alert"], .error-message')
  await expect(error).toContainText(errorMessage)
})

Then('permanezco en la página de login', async function (this: World) {
  await expect(this.page).toHaveURL(/\/login/)
})

When('hago logout', async function (this: World) {
  // Click on user menu (usually in header)
  const userMenu = this.page.locator('[data-testid="user-menu"], button:has-text("Account")')
  await userMenu.click()

  // Find and click logout
  const logoutBtn = this.page.locator('[data-testid="logout-btn"], button:has-text("Logout")')
  await logoutBtn.click()
})

Then('soy redireccionado a login', async function (this: World) {
  await this.page.waitForURL('/login', { timeout: 5000 })
})

When('intento acceder a {string} sin autenticación', async function (this: World, path: string) {
  await this.goto(path)
})

Then('soy redireccionado a login automáticamente', async function (this: World) {
  await expect(this.page).toHaveURL(/\/login/, { timeout: 5000 })
})

When('dejo la sesión inactiva por {int} minutos', async function (this: World, minutes: number) {
  // Note: This would require actual session timeout logic
  // For now, we can simulate by waiting
  await this.page.waitForTimeout(minutes * 60 * 1000)
})

Then('la sesión expira automáticamente', async function (this: World) {
  // Try to perform an action and verify redirect to login
  try {
    await this.page.click('[data-testid="sidebar"]')
  } catch {
    // Expected to fail
  }

  await expect(this.page).toHaveURL(/\/login/, { timeout: 5000 })
})
