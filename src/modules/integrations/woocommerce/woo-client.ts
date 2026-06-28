import 'server-only'

/**
 * Minimal typed wrapper around the WooCommerce REST API (v3).
 *
 * Authentication uses HTTP Basic auth with the store's consumer key/secret
 * (recommended over HTTPS). All requests go through the global `fetch`, which in
 * this runtime honours the outbound agent proxy automatically.
 */

export interface WooClientConfig {
  storeUrl: string
  consumerKey: string
  consumerSecret: string
}

export interface WooLineItem {
  id?: number
  product_id?: number
  variation_id?: number
  sku?: string | null
  name?: string
  quantity: number
  /** Line subtotal excluding tax, as a decimal string. */
  subtotal?: string
  /** Line total excluding tax, as a decimal string. */
  total?: string
  price?: number
}

export interface WooAddress {
  first_name?: string
  last_name?: string
  company?: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
  email?: string
  phone?: string
}

export interface WooOrder {
  id: number
  number?: string
  status: string
  currency?: string
  date_created?: string
  date_modified?: string
  customer_id?: number
  billing?: WooAddress
  shipping?: WooAddress
  line_items: WooLineItem[]
  total?: string
}

export interface WooProduct {
  id: number
  name: string
  sku?: string | null
  type?: string
  regular_price?: string
  description?: string
  manage_stock?: boolean
  stock_quantity?: number | null
  variations?: number[]
}

export class WooApiError extends Error {
  readonly code = 'WOO_API_ERROR' as const
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'WooApiError'
  }
}

export class WooClient {
  private readonly base: string
  private readonly authHeader: string

  constructor(config: WooClientConfig) {
    this.base = `${config.storeUrl.replace(/\/+$/, '')}/wp-json/wc/v3`
    this.authHeader =
      'Basic ' + Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<{ data: T; headers: Headers }> {
    const url = new URL(`${this.base}${path}`)
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new WooApiError(res.status, `WooCommerce ${method} ${path} → ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = (await res.json().catch(() => null)) as T
    return { data, headers: res.headers }
  }

  /** Iterates every page of a list endpoint (100 per page) and returns all rows. */
  private async listAll<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
    const out: T[] = []
    let page = 1
    // WooCommerce caps per_page at 100; X-WP-TotalPages tells us when to stop.
    for (;;) {
      const { data, headers } = await this.request<T[]>('GET', path, {
        query: { ...query, per_page: 100, page },
      })
      if (Array.isArray(data)) out.push(...data)
      const totalPages = Number(headers.get('x-wp-totalpages') ?? '1')
      if (!Number.isFinite(totalPages) || page >= totalPages) break
      page += 1
    }
    return out
  }

  // --- Products ---

  listProducts(): Promise<WooProduct[]> {
    return this.listAll<WooProduct>('/products')
  }

  listVariations(productId: number): Promise<WooProduct[]> {
    return this.listAll<WooProduct>(`/products/${productId}/variations`)
  }

  async createProduct(body: Record<string, unknown>): Promise<WooProduct> {
    return (await this.request<WooProduct>('POST', '/products', { body })).data
  }

  async updateProduct(productId: number, body: Record<string, unknown>): Promise<WooProduct> {
    return (await this.request<WooProduct>('PUT', `/products/${productId}`, { body })).data
  }

  async updateVariation(productId: number, variationId: number, body: Record<string, unknown>): Promise<WooProduct> {
    return (await this.request<WooProduct>('PUT', `/products/${productId}/variations/${variationId}`, { body })).data
  }

  /** Push a new stock quantity onto a product or a specific variation. */
  async setStock(productId: number, variationId: number | null, quantity: number): Promise<void> {
    const body = { manage_stock: true, stock_quantity: quantity }
    if (variationId) {
      await this.request('PUT', `/products/${productId}/variations/${variationId}`, { body })
    } else {
      await this.request('PUT', `/products/${productId}`, { body })
    }
  }

  // --- Orders ---

  listOrders(query: { after?: string; status?: string } = {}): Promise<WooOrder[]> {
    return this.listAll<WooOrder>('/orders', query)
  }

  async getOrder(orderId: number): Promise<WooOrder> {
    return (await this.request<WooOrder>('GET', `/orders/${orderId}`)).data
  }

  // --- Webhooks ---

  async createWebhook(topic: string, deliveryUrl: string, secret: string): Promise<{ id: number }> {
    return (
      await this.request<{ id: number }>('POST', '/webhooks', {
        body: { name: `Andiko ${topic}`, topic, delivery_url: deliveryUrl, secret, status: 'active' },
      })
    ).data
  }
}
