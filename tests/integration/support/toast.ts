import { expect, type Page } from '@playwright/test'

/** Sonner toasts — not `[role="status"]` (that matches Next route announcer). */
export function toastLocator(page: Page) {
  return page.locator('[data-sonner-toast]')
}

export async function expectToast(page: Page, message: string | RegExp, timeout = 10000): Promise<void> {
  const toast = toastLocator(page).filter({ hasText: message })
  await expect(toast.first()).toBeVisible({ timeout })
}
