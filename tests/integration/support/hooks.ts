import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber'
import { chromium, Browser } from '@playwright/test'
import type { World } from './world'

let browser: Browser

function isHeadless(): boolean {
  return process.env.HEADLESS !== 'false'
}

BeforeAll(async () => {
  const headless = isHeadless()

  browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 250,
  })
})

AfterAll(async () => {
  await browser?.close()
})

Before({ tags: '@skip' }, function () {
  return 'skipped'
})

Before(async function (this: World, { pickle }) {
  console.log(`\n📋 Running: ${pickle.name}`)

  this.context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  })

  this.page = await this.context.newPage()

  // Log network requests for debugging
  this.page.on('response', (response) => {
    if (!response.ok() && !response.url().includes('fonts')) {
      console.warn(`⚠️  ${response.status()} ${response.url()}`)
    }
  })
})

After(async function (this: World, { pickle, result }) {
  if (!this.context) return

  if (result?.status === Status.FAILED && this.page) {
    await this.page.screenshot({ path: `test-results/${pickle.id}.png` })
    console.error(`❌ Failed - Screenshot: test-results/${pickle.id}.png`)
  }

  await this.context.close()
})
