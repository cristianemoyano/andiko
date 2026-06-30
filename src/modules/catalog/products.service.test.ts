import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProductInput } from './product.schema'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const transactionMock = vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)({}))
vi.mock('@/lib/db', () => ({
  default: {
    transaction: transactionMock,
  },
}))

const productFindAndCountAll = vi.fn()
const productFindOne = vi.fn()
const productCreate = vi.fn()
vi.mock('./product.model', () => ({
  default: {
    findAndCountAll: productFindAndCountAll,
    findOne: productFindOne,
    create: productCreate,
  },
}))

const variantCreate = vi.fn()
const variantUpdate = vi.fn()
vi.mock('./product-variant.model', () => ({
  default: {
    create: variantCreate,
    update: variantUpdate,
  },
}))

vi.mock('./product-category.model', () => ({ default: {} }))
vi.mock('./catalog-import-persist', () => ({ persistUnmappedCsvColumns: vi.fn() }))
vi.mock('./catalog-import-price-list', () => ({ syncImportedPriceToDefaultList: vi.fn() }))
vi.mock('./catalog-import-stock', () => ({ syncImportedStockIfMapped: vi.fn() }))
vi.mock('./catalog-import-category', () => ({ resolveOrCreateCategoryIdForImport: vi.fn() }))
vi.mock('./allocate-variant-sku', () => ({ allocateUniqueVariantSku: vi.fn() }))
vi.mock('./products-hierarchical-import', () => ({ importProductsHierarchical: vi.fn() }))
vi.mock('@/modules/integrations/woocommerce/woocommerce-product-link.model', () => ({
  default: { findAll: vi.fn().mockResolvedValue([]) },
}))

describe('catalog/products.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listProducts includes variants+category and supports sku search', async () => {
    productFindAndCountAll.mockResolvedValue({ rows: [], count: 0 })

    const { listProducts } = await import('./products.service')

    await listProducts(
      { page: 1, limit: 20, search: 'RESM' },
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }
    )

    expect(productFindAndCountAll).toHaveBeenCalledTimes(1)
    const arg = productFindAndCountAll.mock.calls[0]![0]
    expect(arg).toMatchObject({
      distinct: true,
      subQuery: false,
    })
    expect(Array.isArray(arg.include)).toBe(true)
    const includes = arg.include as unknown as Array<{ as?: string }>
    expect(includes.some(i => i.as === 'variants')).toBe(true)
    expect(includes.some(i => i.as === 'category')).toBe(true)
    const andKey = Object.getOwnPropertySymbols(arg.where)[0]
    expect(andKey).toBeDefined()
    const clauses = (arg.where as Record<symbol, unknown>)[andKey!] as Record<string | symbol, unknown>[]
    const hasSkuSearch = clauses.some((clause) => {
      const orKey = Object.getOwnPropertySymbols(clause)[0]
      if (!orKey) return false
      return JSON.stringify(clause[orKey]).includes('$variants.sku$')
    })
    expect(hasSkuSearch).toBe(true)
  })

  it('createProduct sets default stock fields when missing', async () => {
    productCreate.mockResolvedValue({ id: 'p1', org_id: null })

    const { createProduct } = await import('./products.service')

    await createProduct(
      {
        name: 'Resma A4',
        sku: 'res-a4',
        // omit manage_stock + stock_quantity
      } as unknown as ProductInput,
      'u1' as unknown as string,
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }
    )

    expect(variantCreate).toHaveBeenCalledTimes(1)
    const payload = variantCreate.mock.calls[0]![0]
    expect(payload.manage_stock).toBe(true)
    expect(payload.stock_quantity).toBe(0)
  })

  it('createProduct uses provided stock fields', async () => {
    productCreate.mockResolvedValue({ id: 'p1', org_id: null })

    const { createProduct } = await import('./products.service')

    await createProduct(
      {
        name: 'Resma A4',
        sku: 'res-a4',
        manage_stock: false,
        stock_quantity: 12,
      } as unknown as ProductInput,
      'u1' as unknown as string,
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }
    )

    const payload = variantCreate.mock.calls[0]![0]
    expect(payload.manage_stock).toBe(false)
    expect(payload.stock_quantity).toBe(12)
  })
})

