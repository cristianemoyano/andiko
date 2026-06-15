import { IWorld, IWorldOptions, setDefaultTimeout } from '@cucumber/cucumber'
import { Browser, Page, BrowserContext } from 'playwright'

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

export class World extends IWorld {
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
    await this.page.goto(`${this.baseUrl}${path}`)
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
      throw new Error(`API call failed: ${method} ${endpoint} - ${response.status()}`)
    }

    try {
      return await response.json()
    } catch {
      return null
    }
  }

  async login(email: string, password: string) {
    await this.goto('/login')
    await this.page.fill('input[type="email"]', email)
    await this.page.fill('input[type="password"]', password)
    await this.page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await this.page.waitForURL((url) => url.pathname.includes('/erp'), { timeout: 10000 })
  }

  async logout() {
    // Click user menu or logout button
    await this.page.click('[data-testid="user-menu"]')
    await this.page.click('[data-testid="logout-btn"]')
    await this.page.waitForURL((url) => url.pathname === '/login')
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
