import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Op } from 'sequelize'
import type { ProductInput } from './product.schema'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const transactionMock = vi.fn(async (fn: unknown) => (fn as (t: unknown) => unknown)({}))
vi.mock('@/lib/db', () => ({
  default: {
    transaction: transactionMock,
  },
}))

const productFindAll = vi.fn()
const productCount = vi.fn()
const productFindOne = vi.fn()
const productCreate = vi.fn()
vi.mock('./product.model', () => ({
  default: {
    findAll: productFindAll,
    count: productCount,
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
    productFindAll.mockReset()
    productCount.mockReset()
    productFindOne.mockReset()
    productCreate.mockReset()
    variantCreate.mockReset()
    variantUpdate.mockReset()
  })

  it('listProducts resolves page ids via a grouped query and supports sku search', async () => {
    productFindAll.mockResolvedValue([])
    productCount.mockResolvedValue(0)

    const { listProducts } = await import('./products.service')

    await listProducts(
      { page: 1, limit: 20, search: 'RESM' },
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }
    )

    // Search path: subQuery:false + GROUP BY products.id (qualified — not bare "id" or "Product.id").
    expect(productFindAll).toHaveBeenCalledTimes(1)
    const arg = productFindAll.mock.calls[0]![0]
    expect(arg).toMatchObject({
      subQuery: false,
    })
    expect(arg.group).toEqual([expect.objectContaining({ val: '"products"."id"' })])
    expect(Array.isArray(arg.include)).toBe(true)
    const includes = arg.include as unknown as Array<{ as?: string }>
    expect(includes.some(i => i.as === 'variants')).toBe(true)

    expect(productCount).toHaveBeenCalledTimes(1)
    const countArg = productCount.mock.calls[0]![0]
    expect(countArg).toMatchObject({ distinct: true, col: 'id' })

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

  it('listProducts without search skips variant join and GROUP BY', async () => {
    productFindAll.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    productCount.mockResolvedValue(0)

    const { listProducts } = await import('./products.service')

    await listProducts(
      { page: 1, limit: 20 },
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] },
    )

    const idArg = productFindAll.mock.calls[0]![0]
    expect(idArg.subQuery).toBeUndefined()
    expect(idArg.group).toBeUndefined()
    expect(idArg.include).toBeUndefined()
    expect(productCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.any(Object) }))
    const countArg = productCount.mock.calls[0]![0]
    expect(countArg.include).toBeUndefined()
  })

  it('listProducts loads full rows for the resolved page ids, preserving page order', async () => {
    const makeRow = (id: string) => ({ id, toJSON: () => ({ id }), get: () => undefined })
    productFindAll
      .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }]) // id-resolution query, in page order
      .mockResolvedValueOnce([makeRow('p2'), makeRow('p1')]) // full-row query, arbitrary DB order

    productCount.mockResolvedValue(2)

    const { listProducts } = await import('./products.service')

    const result = await listProducts(
      { page: 1, limit: 20 },
      { orgId: 'o1', userId: 'u1', defaultBranchId: null, allowedBranchIds: [] }
    )

    expect(productFindAll).toHaveBeenCalledTimes(2)
    const secondArg = productFindAll.mock.calls[1]![0]
    expect(secondArg.where).toEqual({ id: { [Op.in]: ['p1', 'p2'] } })

    expect(result.total).toBe(2)
    // Order follows the id-resolution query (p1, p2), not the full-row query's order (p2, p1).
    expect(result.data.map(p => p.id)).toEqual(['p1', 'p2'])
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

