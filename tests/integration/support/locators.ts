import type { Page, Locator } from '@playwright/test'

/**
 * Resolves duplicated data-testid nodes (TopBar + toolbar, desktop + mobile cards).
 * Always targets the visible instance Playwright can interact with.
 */
export function byTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]`).locator('visible=true').first()
}

export function byTestIdAttr(
  page: Page,
  testId: string,
  attrs: Record<string, string>,
): Locator {
  let selector = `[data-testid="${testId}"]`
  for (const [key, value] of Object.entries(attrs)) {
    selector += `[data-${key}="${value}"]`
  }
  return page.locator(selector).locator('visible=true').first()
}

/** Rows rendered in the desktop table body (avoids mobile card duplicates). */
export function desktopTableTestIds(page: Page, testId: string): Locator {
  return page.locator(`table tbody [data-testid="${testId}"]`)
}

export function desktopTableTestIdAttr(
  page: Page,
  testId: string,
  attrs: Record<string, string>,
): Locator {
  let selector = `table tbody [data-testid="${testId}"]`
  for (const [key, value] of Object.entries(attrs)) {
    selector += `[data-${key}="${value}"]`
  }
  return page.locator(selector).first()
}
