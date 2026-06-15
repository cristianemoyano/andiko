import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber'
import { chromium, Browser } from 'playwright'
import type { World } from './world'

let browser: Browser

BeforeAll(async () => {
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
  })
})

AfterAll(async () => {
  await browser.close()
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
  // Take screenshot on failure
  if (result?.status === Status.FAILED) {
    await this.page.screenshot({ path: `test-results/${pickle.id}.png` })
    console.error(`❌ Failed - Screenshot: test-results/${pickle.id}.png`)
  }

  await this.context.close()
})
