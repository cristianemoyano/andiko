import 'server-only'
import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import Product from './product.model'
import ProductCategory from './product-category.model'
import ProductVariant from './product-variant.model'
import { generateSlug, formatSku, normalizeProductImagesForDb, slugForImportedProduct, importBasePrice } from './product.utils'
import { persistUnmappedCsvColumns } from './catalog-import-persist'
import { syncImportedPriceToDefaultList } from './catalog-import-price-list'
import { bindImportStockWarehouse, syncImportedStockIfMapped } from './catalog-import-stock'
import { resolveOrCreateCategoryIdForImport } from './catalog-import-category'
import { allocateUniqueVariantSku } from './allocate-variant-sku'
import { importProductsHierarchical } from './products-hierarchical-import'
import { paginate, toPaginated } from '@/lib/pagination'
import logger from '@/lib/logger'
import type { ProductInput, ProductUpdateInput, ProductQuery } from './product.schema'
import { productSchema, productUpdateSchema } from './product.schema'
import type { UUID } from '@/types'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'
import type { ImportProgressCallback } from '@/lib/import-progress'
import { createImportProgressReporter } from '@/lib/import-progress'
import {
  combineListWhere,
  importSourceListWhere,
  resolveListSource,
} from '@/modules/integrations/woocommerce/woo-list-filters'
import WoocommerceProductLink from '@/modules/integrations/woocommerce/woocommerce-product-link.model'
import {
  applyRowImportDefaults,
  mappedRowToNormalizedProductRow,
  parseProductCsvImages,
  rowToProductInput,
  rowToProductUpdateInput,
  usesHierarchicalProductImport,
} from './products-csv-adapter'

/** Si faltan mapeos explícitos, completa desde cabeceras habituales de export WooCommerce (ES/EN). */
function enrichMappedRowsFromCommonExports(
  rawRows: Record<string, string>[],
  mappedRows: Record<string, string>[],
): Record<string, string>[] {
  const pickRaw = (raw: Record<string, string>, keys: string[]): string => {
    for (const k of keys) {
      const v = raw[k]?.trim()
      if (v) return v
    }
    return ''
  }

  return mappedRows.map((mapped, i) => {
    const raw = rawRows[i]!
    const m = { ...mapped }
    if (!(m.catalog_external_id ?? '').trim()) {
      const v = pickRaw(raw, ['ID', 'Id', 'id'])
      if (v) m.catalog_external_id = v
    }
    if (!(m.catalog_parent_id ?? '').trim()) {
      const v = pickRaw(raw, ['Superior', 'Parent', 'parent', 'Padre', 'Parent SKU'])
      if (v) m.catalog_parent_id = v
    }
    if (!(m.catalog_position ?? '').trim()) {
      const v = pickRaw(raw, ['Posición', 'Posicion', 'Position', 'position'])
      if (v) m.catalog_position = v
    }
    return m
  })
}

export async function listProducts(query: ProductQuery, ctx: TenantContext) {
  const { page, limit, search, category_id, status, product_type, source } = query
  const { offset } = paginate(page, limit)

  const where = combineListWhere(
    whereOrg(ctx),
    status ? { status } : {},
    product_type ? { product_type } : {},
    category_id ? { category_id } : {},
    source ? importSourceListWhere(source, ctx.orgId, 'product') : {},
    search
      ? {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { vendor: { [Op.iLike]: `%${search}%` } },
            { '$variants.sku$': { [Op.iLike]: `%${search}%` } },
          ],
        }
      : {},
  )

  // Filtering by a joined column (variants.sku) forces subQuery:false (Sequelize's default
  // pagination subquery doesn't include the JOIN, so it can't resolve `$variants.sku$`). But
  // subQuery:false also means LIMIT/OFFSET apply to the product×variant join output, not to
  // products — a product with N variants consumes N rows of the page budget, silently
  // shrinking pages and permanently skipping products at the page boundary. So resolve the
  // page of product ids first (deduped via GROUP BY on the primary key — Postgres allows
  // ordering by other columns of the same table via functional dependency), then load the
  // full rows for exactly those ids.
  const idRows = await Product.findAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    subQuery: false,
    attributes: ['id'],
    group: ['id'],
    include: [
      { model: ProductVariant, as: 'variants', required: false, attributes: [] },
    ],
  })
  const count = await Product.count({
    where,
    distinct: true,
    col: 'id',
    include: [
      { model: ProductVariant, as: 'variants', required: false, attributes: [] },
    ],
  })

  const pageIds = idRows.map(r => r.id)
  const unorderedRows = pageIds.length
    ? await Product.findAll({
        where: { id: { [Op.in]: pageIds } },
        attributes: [
          'id', 'name', 'slug', 'product_type', 'status', 'iva_rate', 'unit_of_measure', 'vendor',
          'category_id', 'images', 'created_at', 'import_source', 'import_external_id',
        ],
        include: [
          {
            model: ProductVariant,
            as: 'variants',
            required: false,
            attributes: ['id', 'sku', 'barcode', 'name', 'base_price', 'stock_quantity', 'manage_stock', 'is_default'],
          },
          {
            model: ProductCategory,
            as: 'category',
            required: false,
            attributes: ['id', 'name'],
          },
        ],
      })
    : []
  // Re-apply the id query's order rather than re-sorting by name here: `name` isn't unique,
  // so a second independent ORDER BY name query could break ties differently and shuffle
  // items within the page relative to the authoritative page split decided above.
  const rowById = new Map(unorderedRows.map(row => [row.id, row]))
  const rows = pageIds.map(id => rowById.get(id)).filter((row): row is Product => row !== undefined)

  const variantIds = rows.flatMap((row) => {
    const variants = row.get('variants') as ProductVariant[] | undefined
    return (variants ?? []).map((variant) => variant.id)
  })
  const linkedVariantIds = variantIds.length
    ? new Set(
        (
          await WoocommerceProductLink.findAll({
            where: { org_id: ctx.orgId, variant_id: { [Op.in]: variantIds } },
            attributes: ['variant_id'],
            raw: true,
          })
        ).map((link) => link.variant_id as string),
      )
    : new Set<string>()

  const data = rows.map((row) => {
    const variants = row.get('variants') as ProductVariant[] | undefined
    const wooLinked = (variants ?? []).some((variant) => linkedVariantIds.has(variant.id))
    return {
      ...row.toJSON(),
      source: resolveListSource(row.import_source, wooLinked),
    }
  })

  return toPaginated(data, count, page, limit)
}

export async function getProduct(id: UUID, ctx: TenantContext) {
  const product = await Product.findOne({
    where: whereOrg(ctx, { id }),
    include: [
      { model: ProductVariant, as: 'variants', attributes: { exclude: ['created_by', 'updated_by', 'deleted_by'] } },
      { model: ProductCategory, as: 'category', required: false, attributes: ['id', 'name'] },
    ],
  })
  if (!product) throw new Error('PRODUCT_NOT_FOUND')
  return product
}

/**
 * Verifica que el PLU no esté usado por otra variante viva de la misma organización.
 * El índice único parcial en la DB es el resguardo final; esto da un error claro antes.
 */
async function assertPluCodeAvailable(
  pluCode: string,
  orgId: UUID,
  excludeVariantId: UUID | null,
  transaction: Transaction,
) {
  const where: Record<string, unknown> = { org_id: orgId, plu_code: pluCode }
  if (excludeVariantId) where.id = { [Op.ne]: excludeVariantId }
  const existing = await ProductVariant.findOne({ where, attributes: ['id'], transaction })
  if (existing) throw new Error('PLU_CODE_TAKEN')
}

export async function createProduct(input: ProductInput, actorId: UUID, ctx: TenantContext) {
  const { sku, barcode, cost_price, base_price, manage_stock, allow_backorder, stock_quantity, images, sold_by_weight, plu_code, ...productData } = input

  return sequelize.transaction(async (t) => {
    const slug = generateSlug(productData.name)

    if (plu_code) await assertPluCodeAvailable(plu_code, ctx.orgId, null, t)

    const product = await Product.create(
      {
        ...productData,
        images: normalizeProductImagesForDb(images),
        slug,
        org_id: ctx.orgId,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t }
    )

    await ProductVariant.create(
      {
        product_id:     product.id,
        org_id:         ctx.orgId,
        sku:            formatSku(sku),
        barcode:        barcode ?? null,
        is_default:     true,
        cost_price:     cost_price ?? null,
        base_price:     base_price ?? null,
        manage_stock:   manage_stock ?? true,
        allow_backorder: (manage_stock ?? true) ? (allow_backorder ?? false) : false,
        stock_quantity: stock_quantity ?? 0,
        sold_by_weight: sold_by_weight ?? false,
        plu_code:       plu_code ?? null,
        created_by:     actorId,
        updated_by:     actorId,
      },
      { transaction: t }
    )

    logger.info({ productId: product.id, actorId }, 'product created')
    return product
  })
}

export async function updateProduct(id: UUID, input: ProductUpdateInput, actorId: UUID, ctx: TenantContext) {
  const product = await getProduct(id, ctx)

  const { sku, barcode, cost_price, base_price, stock_quantity, manage_stock, allow_backorder, images, sold_by_weight, plu_code, ...productData } = input

  await sequelize.transaction(async (t) => {
    const payload: Record<string, unknown> = { ...productData, updated_by: actorId }
    if (productData.name) payload.slug = generateSlug(productData.name)
    if (images !== undefined) payload.images = normalizeProductImagesForDb(images)
    if (Object.keys(productData).length > 0 || images !== undefined) {
      await product.update(payload as Parameters<typeof product.update>[0], { transaction: t })
    }

    if (plu_code) {
      const defaultVariant = await ProductVariant.findOne({
        where: { product_id: id, is_default: true, org_id: ctx.orgId },
        attributes: ['id'],
        transaction: t,
      })
      await assertPluCodeAvailable(plu_code, ctx.orgId, defaultVariant?.id ?? null, t)
    }

    const variantUpdates: Record<string, unknown> = {}
    if (sku !== undefined)            variantUpdates.sku            = formatSku(sku)
    if (barcode !== undefined)        variantUpdates.barcode        = barcode
    if (cost_price !== undefined)     variantUpdates.cost_price     = cost_price
    if (base_price !== undefined)     variantUpdates.base_price     = base_price
    if (stock_quantity !== undefined) variantUpdates.stock_quantity = stock_quantity
    if (manage_stock !== undefined)   variantUpdates.manage_stock   = manage_stock
    const defaultVariant = (product.get('variants') as ProductVariant[] | undefined)?.find((v) => v.is_default)
      ?? (product.get('variants') as ProductVariant[] | undefined)?.[0]
    const effectiveManageStock = manage_stock ?? defaultVariant?.manage_stock ?? true
    if (!effectiveManageStock) {
      variantUpdates.allow_backorder = false
    } else if (allow_backorder !== undefined) {
      variantUpdates.allow_backorder = allow_backorder
    }
    if (sold_by_weight !== undefined) variantUpdates.sold_by_weight = sold_by_weight
    if (plu_code !== undefined)       variantUpdates.plu_code       = plu_code

    if (Object.keys(variantUpdates).length > 0) {
      await ProductVariant.update(
        { ...variantUpdates, updated_by: actorId },
        { where: { product_id: id, is_default: true, org_id: ctx.orgId }, transaction: t }
      )
    }
  })

  logger.info({ productId: id, actorId }, 'product updated')
  return getProduct(id, ctx)
}

export async function deleteProduct(id: UUID, actorId: UUID, ctx: TenantContext) {
  const product = await getProduct(id, ctx)
  await sequelize.transaction(async (t) => {
    await ProductVariant.update({ deleted_by: actorId }, { where: { product_id: id, org_id: ctx.orgId }, transaction: t })
    await ProductVariant.destroy({ where: { product_id: id, org_id: ctx.orgId }, transaction: t })
    await product.update({ deleted_by: actorId }, { transaction: t })
    await product.destroy({ transaction: t })
  })
  logger.info({ productId: id, actorId }, 'product deleted')
}

export async function deleteProductsBulk(ids: UUID[], actorId: UUID, ctx: TenantContext) {
  const uniqueIds = [...new Set(ids)]
  const errors: { id: string; message: string }[] = []
  let deleted = 0

  for (const id of uniqueIds) {
    try {
      await deleteProduct(id, actorId, ctx)
      deleted++
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'PRODUCT_NOT_FOUND'
          ? 'Producto no encontrado'
          : 'No se pudo eliminar'
      errors.push({ id, message })
    }
  }

  logger.info({ deleted, failed: errors.length, actorId }, 'products bulk deleted')
  return { deleted, errors }
}

export type ImportAction = 'create' | 'update' | 'upsert'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
}

export type CatalogImportOptions = {
  /** Depósito donde cargar stock cuando el CSV mapea `stock_quantity`. */
  stockWarehouseId?: string | null
}

export async function listProductsForExport(
  query: Pick<ProductQuery, 'search' | 'status' | 'product_type' | 'category_id'>,
  ctx: TenantContext,
  limit: number,
) {
  const where: Record<string, unknown> = whereOrg(ctx)
  if (query.status) where.status = query.status
  if (query.product_type) where.product_type = query.product_type
  if (query.category_id) where.category_id = query.category_id
  if (query.search) {
    where[Op.or as unknown as string] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { vendor: { [Op.iLike]: `%${query.search}%` } },
      { '$variants.sku$': { [Op.iLike]: `%${query.search}%` } },
    ]
  }

  return Product.findAll({
    where,
    limit,
    order: [['name', 'ASC']],
    subQuery: false,
    attributes: [
      'id',
      'name',
      'product_type',
      'status',
      'vendor',
      'iva_rate',
      'unit_of_measure',
      'description',
      'short_description',
      'ncm_code',
      'tags',
    ],
    include: [
      {
        model: ProductVariant,
        as: 'variants',
        where: { is_default: true },
        required: false,
        attributes: ['sku', 'base_price', 'cost_price', 'barcode', 'manage_stock', 'stock_quantity', 'is_default'],
      },
      {
        model: ProductCategory,
        as: 'category',
        required: false,
        attributes: ['id', 'name'],
      },
    ],
  })
}

export async function importProducts(
  rawRows: Record<string, string>[],
  mappedRows: Record<string, string>[],
  columnMapping: Record<string, string>,
  action: ImportAction,
  ctx: TenantContext,
  actorId: string,
  importSource = 'catalog_csv',
  importDefaults: Record<string, string> = {},
  importOptions: CatalogImportOptions = {},
  onProgress?: ImportProgressCallback,
): Promise<ImportResult> {
  const IMPORT_BATCH_SIZE = 1000
  const enriched = enrichMappedRowsFromCommonExports(rawRows, mappedRows)
  const mappedRowsEffective = enriched.map((row) => applyRowImportDefaults(row, importDefaults))
  const total = mappedRowsEffective.length

  if (usesHierarchicalProductImport(mappedRowsEffective)) {
    return importProductsHierarchical(
      rawRows,
      mappedRowsEffective,
      columnMapping,
      action,
      ctx,
      actorId,
      importSource,
      importOptions,
      onProgress,
    )
  }

  const errors: ImportResult['errors'] = []
  let created = 0
  let updated = 0
  let skipped = 0

  const categories = await ProductCategory.findAll({
    where: whereOrg(ctx),
    attributes: ['id', 'name'],
  })
  const categoryByName = new Map<string, string>(
    categories.map((category) => [category.name.trim().toLowerCase(), category.id]),
  )

  let processedRows = 0
  const progress = createImportProgressReporter(total, onProgress)
  for (let start = 0; start < mappedRowsEffective.length; start += IMPORT_BATCH_SIZE) {
    const end = Math.min(start + IMPORT_BATCH_SIZE, mappedRowsEffective.length)
    await sequelize.transaction(async (t) => {
      bindImportStockWarehouse(t, importOptions.stockWarehouseId ?? null)
      for (let i = start; i < end; i++) {
        try {
        const rowNum = i + 2
        const mapped = mappedRowsEffective[i]!
        const raw = rawRows[i]!
        const normalizedBase = mappedRowToNormalizedProductRow(mapped)
        const importExtEarly = (mapped.catalog_external_id ?? '').trim() || null
        const normalizedSku = normalizedBase.sku ? formatSku(normalizedBase.sku) : ''
        let skuForRow =
          normalizedSku || (importExtEarly ? formatSku(`W${importExtEarly}`) : '')

        if (!skuForRow) {
          skuForRow = await allocateUniqueVariantSku(
            ctx,
            '',
            `I${rowNum}-${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            t,
          )
        }

        const normalized = { ...normalizedBase, sku: skuForRow }

        let categoryId: string | undefined
        if (normalized.category_name) {
          categoryId = await resolveOrCreateCategoryIdForImport(
            normalized.category_name,
            categoryByName,
            ctx,
            actorId,
            t,
          )
        }

        const images = parseProductCsvImages(mapped.images_urls ?? '')
        const rowInput = rowToProductInput(normalized, categoryId)
        if (images.length > 0) rowInput.images = images
        const rowUpdate = rowToProductUpdateInput(normalized, categoryId, {
          priceMapped: 'base_price' in mapped,
          stockMapped: 'stock_quantity' in mapped,
        })
        if (images.length > 0) rowUpdate.images = images

        const importExt = importExtEarly
        const rowKey = (importExt ?? skuForRow).slice(0, 64)

        const existingVariant = await ProductVariant.findOne({
          where: {
            ...whereOrg(ctx),
            sku: skuForRow,
            is_default: true,
          },
          include: [{
            model: Product,
            as: 'product',
            required: true,
            where: whereOrg(ctx),
            attributes: ['id', 'name', 'import_external_id'],
          }],
          transaction: t,
        })

        const importOpts = { importSource, importExternalId: importExt }

        if (action === 'create') {
          if (existingVariant) {
            skipped++
            continue
          }
          const parsed = productSchema.safeParse(rowInput)
          if (!parsed.success) {
            const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
            errors.push({ row: rowNum, message: msgs })
            continue
          }
          const { productId, variantId } = await createProductFromImport(parsed.data, actorId, ctx, t, {
            ...importOpts,
            stockMapped: 'stock_quantity' in mapped,
          })
          created++
          await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, rowKey, productId, variantId, t)
          continue
        }

        if (action === 'update') {
          if (!existingVariant) {
            skipped++
            continue
          }
          const parsed = productUpdateSchema.safeParse(rowUpdate)
          if (!parsed.success) {
            const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
            errors.push({ row: rowNum, message: msgs })
            continue
          }
          await updateProductFromImport(existingVariant, parsed.data, actorId, ctx, t, {
            ...importOpts,
            stockMapped: 'stock_quantity' in mapped,
          })
          updated++
          const product = existingVariant.get('product') as Product
          await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, rowKey, product.id, existingVariant.id, t)
          continue
        }

        if (existingVariant) {
          const parsed = productUpdateSchema.safeParse(rowUpdate)
          if (!parsed.success) {
            const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
            errors.push({ row: rowNum, message: msgs })
            continue
          }
          await updateProductFromImport(existingVariant, parsed.data, actorId, ctx, t, {
            ...importOpts,
            stockMapped: 'stock_quantity' in mapped,
          })
          updated++
          const product = existingVariant.get('product') as Product
          await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, rowKey, product.id, existingVariant.id, t)
        } else {
          const parsed = productSchema.safeParse(rowInput)
          if (!parsed.success) {
            const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
            errors.push({ row: rowNum, message: msgs })
            continue
          }
          const { productId, variantId } = await createProductFromImport(parsed.data, actorId, ctx, t, {
            ...importOpts,
            stockMapped: 'stock_quantity' in mapped,
          })
          created++
          await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, rowKey, productId, variantId, t)
        }
        } finally {
          processedRows++
          progress.tick(processedRows)
        }
      }
    })
  }

  progress.finish()
  logger.info({ created, updated, skipped, actorId }, 'products imported')
  return { created, updated, skipped, errors }
}

async function createProductFromImport(
  input: ProductInput,
  actorId: string,
  ctx: TenantContext,
  transaction: Transaction,
  opts: { importSource: string; importExternalId: string | null; stockMapped?: boolean },
): Promise<{ productId: string; variantId: string }> {
  const { sku, barcode, cost_price, base_price, manage_stock, stock_quantity, images, ...productData } = input
  const slug = slugForImportedProduct(productData.name, opts.importExternalId)
  const product = await Product.create(
    {
      ...productData,
      images: normalizeProductImagesForDb(images),
      slug,
      org_id: ctx.orgId,
      import_source: opts.importSource,
      import_external_id: opts.importExternalId,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )

  const variant = await ProductVariant.create(
    {
      product_id: product.id,
      org_id: ctx.orgId,
      sku: formatSku(sku),
      barcode: barcode ?? null,
      is_default: true,
      cost_price: cost_price ?? null,
      base_price: importBasePrice(base_price),
      manage_stock: manage_stock ?? true,
      stock_quantity: stock_quantity ?? 0,
      import_external_id: opts.importExternalId,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )
  await syncImportedPriceToDefaultList(ctx.orgId, variant.id, base_price, actorId, transaction)
  await syncImportedStockIfMapped({
    orgId:         ctx.orgId,
    variantId:     variant.id,
    manageStock:   manage_stock ?? true,
    stockQuantity: stock_quantity,
    actorId,
    transaction,
  })
  return { productId: product.id, variantId: variant.id }
}

async function updateProductFromImport(
  variant: ProductVariant,
  input: ProductUpdateInput,
  actorId: string,
  ctx: TenantContext,
  transaction: Transaction,
  opts?: { importSource?: string; importExternalId?: string | null; stockMapped?: boolean },
) {
  const product = variant.get('product') as Product | undefined
  if (!product) return

  const { barcode, cost_price, base_price, stock_quantity, manage_stock, images, ...productData } = input
  const nextProductData: Record<string, unknown> = { ...productData }
  if (productData.name) {
    const ext = opts?.importExternalId ?? product.import_external_id
    nextProductData.slug = slugForImportedProduct(productData.name as string, ext)
  }
  if (opts?.importSource !== undefined) {
    nextProductData.import_source = opts.importSource
  }
  if (opts?.importExternalId !== undefined && opts.importExternalId !== null) {
    nextProductData.import_external_id = opts.importExternalId
  }
  if (images !== undefined) {
    nextProductData.images = normalizeProductImagesForDb(images)
  }
  if (Object.keys(nextProductData).length > 0) {
    await product.update(
      { ...nextProductData, updated_by: actorId } as Parameters<typeof product.update>[0],
      { transaction },
    )
  }

  const variantUpdates: Record<string, unknown> = {}
  if (barcode !== undefined) variantUpdates.barcode = barcode
  if (cost_price !== undefined) variantUpdates.cost_price = cost_price
  if (base_price !== undefined) variantUpdates.base_price = importBasePrice(base_price)
  if (stock_quantity !== undefined && !opts?.stockMapped) variantUpdates.stock_quantity = stock_quantity
  if (manage_stock !== undefined) variantUpdates.manage_stock = manage_stock
  if (opts?.importExternalId !== undefined && opts.importExternalId !== null) {
    variantUpdates.import_external_id = opts.importExternalId
  }

  if (Object.keys(variantUpdates).length > 0) {
    await variant.update({ ...variantUpdates, updated_by: actorId }, { transaction })
  }

  if (variant.org_id) {
    const priceToSync = base_price !== undefined ? importBasePrice(base_price) : importBasePrice(variant.base_price)
    await syncImportedPriceToDefaultList(variant.org_id, variant.id, priceToSync, actorId, transaction)
    const effectiveManageStock = manage_stock !== undefined ? manage_stock : variant.manage_stock
    await syncImportedStockIfMapped({
      orgId:         variant.org_id,
      variantId:     variant.id,
      manageStock:   effectiveManageStock,
      stockQuantity: stock_quantity ?? Number(variant.stock_quantity),
      actorId,
      transaction,
    })
  }
}

export type SaleProductOption = {
  product_id: string
  variant_id: string
  name: string
  sku: string
  iva_rate: string
  unit_of_measure: string
  price: string
}

export type ResolvedSaleLineRef = SaleProductOption & { ref_id: string }

function formatSaleVariantDisplayName(productName: string, variantName: string | null): string {
  const trimmedVariant = variantName?.trim()
  if (!trimmedVariant || trimmedVariant === productName.trim()) return productName
  if (productName.includes(trimmedVariant)) return productName
  return `${productName} - ${trimmedVariant}`
}

async function mapVariantToSaleOption(
  variant: ProductVariant,
  priceListId: string | undefined,
  orgId: string,
): Promise<SaleProductOption> {
  const { getEffectivePrice } = await import('./price-list.service')
  const product = variant.get('product') as Product

  let price = (variant.base_price as string | null) ?? '0.00'
  if (priceListId) {
    const listPrice = await getEffectivePrice(priceListId, String(variant.id), orgId)
    if (listPrice !== null) price = listPrice
  }

  const productName = String(product.get('name'))
  const variantName = variant.name ? String(variant.name) : null

  return {
    product_id:      String(variant.product_id),
    variant_id:      String(variant.id),
    name:            formatSaleVariantDisplayName(productName, variantName),
    sku:             String(variant.sku),
    iva_rate:        String(product.get('iva_rate')),
    unit_of_measure: String(product.get('unit_of_measure')),
    price,
  }
}

export async function findDefaultSaleVariant(
  productId: string,
  orgId: string,
  transaction?: Transaction,
): Promise<ProductVariant | null> {
  return ProductVariant.findOne({
    where: { product_id: productId, org_id: orgId },
    order: [['is_default', 'DESC'], ['created_at', 'ASC']],
    transaction,
  })
}

export async function listSaleVariantsByIds(
  variantIds: string[],
  priceListId: string | undefined,
  orgId: string,
  opts?: { includeInactive?: boolean },
): Promise<SaleProductOption[]> {
  const ids = [...new Set(variantIds.filter(Boolean))]
  if (ids.length === 0) return []

  const productWhere: Record<string, unknown> = { org_id: orgId }
  if (!opts?.includeInactive) productWhere.status = 'active'

  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: ids }, org_id: orgId },
    attributes: ['id', 'product_id', 'sku', 'name', 'base_price'],
    include: [{
      model: Product,
      as: 'product',
      required: true,
      where: productWhere,
      attributes: ['id', 'name', 'iva_rate', 'unit_of_measure'],
    }],
  })

  const byId = new Map(variants.map((variant) => [String(variant.id), variant]))
  const options = await Promise.all(
    ids
      .map((id) => byId.get(id))
      .filter((variant): variant is ProductVariant => Boolean(variant))
      .map((variant) => mapVariantToSaleOption(variant, priceListId, orgId)),
  )
  return options
}

/** Resolves legacy line refs (variant id stored as product_id, or product id without variant). */
export async function resolveSaleLineCatalogRefs(
  rawIds: string[],
  priceListId: string | undefined,
  orgId: string,
  opts?: { includeInactive?: boolean },
): Promise<ResolvedSaleLineRef[]> {
  const unique = [...new Set(rawIds.filter(Boolean))]
  if (unique.length === 0) return []

  const resolved = new Map<string, SaleProductOption>()
  const productWhere: Record<string, unknown> = { org_id: orgId }
  if (!opts?.includeInactive) productWhere.status = 'active'

  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: unique }, org_id: orgId },
    attributes: ['id', 'product_id', 'sku', 'name', 'base_price'],
    include: [{
      model: Product,
      as: 'product',
      required: true,
      where: productWhere,
      attributes: ['id', 'name', 'iva_rate', 'unit_of_measure'],
    }],
  })

  for (const variant of variants) {
    resolved.set(String(variant.id), await mapVariantToSaleOption(variant, priceListId, orgId))
  }

  const unresolved = unique.filter((id) => !resolved.has(id))
  if (unresolved.length > 0) {
    const productLookupWhere: Record<string, unknown> = { id: { [Op.in]: unresolved }, org_id: orgId }
    if (!opts?.includeInactive) productLookupWhere.status = 'active'
    const products = await Product.findAll({
      where: productLookupWhere,
      attributes: ['id'],
    })
    const productIds = new Set(products.map((product) => String(product.id)))

    for (const rawId of unresolved) {
      if (!productIds.has(rawId)) continue
      const defaultVariant = await findDefaultSaleVariant(rawId, orgId)
      if (!defaultVariant) continue
      const reloadProductWhere: Record<string, unknown> = { org_id: orgId }
      if (!opts?.includeInactive) reloadProductWhere.status = 'active'
      await defaultVariant.reload({
        include: [{
          model: Product,
          as: 'product',
          required: true,
          where: reloadProductWhere,
          attributes: ['id', 'name', 'iva_rate', 'unit_of_measure'],
        }],
      })
      resolved.set(rawId, await mapVariantToSaleOption(defaultVariant, priceListId, orgId))
    }
  }

  return unique
    .filter((refId) => resolved.has(refId))
    .map((refId) => ({ ref_id: refId, ...resolved.get(refId)! }))
}

export async function listProductsForSale(
  search: string | undefined,
  priceListId: string | undefined,
  limit: number,
  orgId: string,
  manageStock?: boolean,
): Promise<SaleProductOption[]> {
  const variantWhere: Record<string, unknown> = { org_id: orgId }
  if (manageStock !== undefined) variantWhere.manage_stock = manageStock

  const productWhere: Record<string, unknown> = { org_id: orgId, status: 'active' }

  if (search?.trim()) {
    const q = `%${search.trim()}%`
    variantWhere[Op.or as unknown as string] = [
      { sku: { [Op.iLike]: q } },
      { name: { [Op.iLike]: q } },
      { '$product.name$': { [Op.iLike]: q } },
    ]
  }

  const variants = await ProductVariant.findAll({
    where: variantWhere,
    limit,
    subQuery: false,
    order: [
      [{ model: Product, as: 'product' }, 'name', 'ASC'],
      ['sku', 'ASC'],
    ],
    attributes: ['id', 'product_id', 'sku', 'name', 'base_price'],
    include: [{
      model: Product,
      as: 'product',
      where: productWhere,
      required: true,
      attributes: ['id', 'name', 'iva_rate', 'unit_of_measure'],
    }],
  })

  return Promise.all(variants.map((variant) => mapVariantToSaleOption(variant, priceListId, orgId)))
}
