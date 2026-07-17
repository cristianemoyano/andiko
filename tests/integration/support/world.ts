import { World as CucumberWorld, IWorldOptions, setDefaultTimeout, setWorldConstructor } from '@cucumber/cucumber'
import { Browser, Page, BrowserContext, expect } from '@playwright/test'
import { resolveAppPath, isAuthenticatedAppPath } from './routes'
import { assertOrgContext } from './org-context'
import { TEST_IDS } from './test-ids'

// Increase timeout for integration tests
setDefaultTimeout(30 * 1000)

export interface TestData {
  user?: {
    email: string
    password: string
    role: string
  }
  supplier?: {
    id?: string
    name: string
    cuit: string
  }
  customer?: {
    id?: string
    name: string
    cuit: string
  }
  products?: Array<{
    id?: string
    code: string
    name: string
    category: string
    stock?: number
    cost_price?: number
    sale_price?: number
  }>
  priceListName?: string
  createdProductName?: string
  createdContactName?: string
  orders?: Array<{
    id?: string
    type: 'purchase' | 'sales'
    number: string
  }>
}

export interface TestResult {
  status?: string
  error?: string
  data?: unknown
  message?: string
  [key: string]: unknown
}

export class World extends CucumberWorld {
  browser!: Browser
  context!: BrowserContext
  page!: Page
  baseUrl: string
  apiUrl: string

  testData: TestData = {}
  lastResult: TestResult = {}

  constructor(options: IWorldOptions) {
    super(options)
    this.baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
    this.apiUrl = `${this.baseUrl}/api/v1`
  }

  async goto(path: string) {
    await this.page.goto(`${this.baseUrl}${resolveAppPath(path)}`)
  }

  async apiCall(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: unknown,
  ): Promise<unknown> {
    const response = await this.page.request[method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](
      `${this.apiUrl}${endpoint}`,
      data ? { data: JSON.stringify(data) } : undefined,
    )

    if (!response.ok()) {
      let detail = ''
      try {
        detail = JSON.stringify(await response.json())
      } catch {
        detail = await response.text()
      }
      throw new Error(`API call failed: ${method} ${endpoint} - ${response.status()} ${detail}`)
    }

    try {
      return await response.json()
    } catch {
      return null
    }
  }

  async login(email: string, password: string) {
    await this.goto('/login')
    await this.page.getByTestId(TEST_IDS.loginEmail).fill(email)
    await this.page.getByTestId(TEST_IDS.loginPassword).fill(password)
    await this.page.getByTestId(TEST_IDS.loginSubmit).click()

    // Wait for redirect to dashboard
    await this.page.waitForURL(
      (url) => isAuthenticatedAppPath(url.pathname),
      { timeout: 10000 },
    )
    await assertOrgContext(this)
  }

  async logout() {
    const userMenu = this.page.getByTestId(TEST_IDS.userMenuTrigger)
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click()
    }
    await this.page.getByTestId(TEST_IDS.logoutBtn).filter({ visible: true }).first().click()
    await this.page.waitForResponse(
      (res) => res.url().includes('/api/auth/signout'),
      { timeout: 10000 },
    ).catch(() => undefined)

    await this.context.clearCookies()

    if (new URL(this.page.url()).pathname !== '/login') {
      await this.page.goto(`${this.baseUrl}/login`, { waitUntil: 'domcontentloaded' }).catch(() => undefined)
    }

    await this.page.waitForURL((url) => url.pathname === '/login', { timeout: 10000 })
    await expect(this.page.getByTestId(TEST_IDS.loginEmail)).toBeVisible()
  }

  async fillForm(data: Record<string, string>) {
    for (const [key, value] of Object.entries(data)) {
      const selector = `input[name="${key}"], textarea[name="${key}"], select[name="${key}"]`
      const element = this.page.locator(selector)

      if (await element.count()) {
        const tagName = await element.evaluate((el) => el.tagName)
        if (tagName === 'SELECT') {
          await element.selectOption(value)
        } else {
          await element.fill(value)
        }
      }
    }
  }

  async waitForApiResponse(pattern: RegExp | string, callback: () => Promise<void>) {
    const responsePromise = this.page.waitForResponse((response) => {
      const url = response.url()
      return typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
    })

    await callback()
    await responsePromise
  }
}

setWorldConstructor(World)
