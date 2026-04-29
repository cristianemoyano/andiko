import 'server-only'
import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import Product from './product.model'
import ProductCategory from './product-category.model'
import ProductVariant from './product-variant.model'
import { generateSlug, formatSku, normalizeProductImagesForDb, slugForImportedProduct } from './product.utils'
import { persistUnmappedCsvColumns } from './catalog-import-persist'
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
  const { page, limit, search, category_id, status, product_type } = query
  const { offset } = paginate(page, limit)

  const where: Record<string, unknown> = whereOrg(ctx)
  if (status)       where.status       = status
  if (product_type) where.product_type = product_type
  if (category_id)  where.category_id  = category_id
  if (search) {
    where[Op.or as unknown as string] = [
      { name:   { [Op.iLike]: `%${search}%` } },
      { vendor: { [Op.iLike]: `%${search}%` } },
      // allow SKU search (joined via variants)
      { '$variants.sku$': { [Op.iLike]: `%${search}%` } },
    ]
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    limit,
    offset,
    order: [['name', 'ASC']],
    distinct: true,
    // Needed when filtering by joined columns (e.g. variants.sku).
    // Otherwise Sequelize places the WHERE in a subquery that doesn't include the JOIN.
    subQuery: false,
    attributes: ['id', 'name', 'slug', 'product_type', 'status', 'iva_rate', 'unit_of_measure', 'vendor', 'category_id', 'images', 'created_at'],
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

  return toPaginated(rows, count, page, limit)
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

export async function createProduct(input: ProductInput, actorId: UUID, ctx: TenantContext) {
  const { sku, barcode, cost_price, base_price, manage_stock, stock_quantity, images, ...productData } = input

  return sequelize.transaction(async (t) => {
    const slug = generateSlug(productData.name)

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
        stock_quantity: stock_quantity ?? 0,
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

  const { sku, barcode, cost_price, base_price, stock_quantity, manage_stock, images, ...productData } = input

  await sequelize.transaction(async (t) => {
    const payload: Record<string, unknown> = { ...productData, updated_by: actorId }
    if (productData.name) payload.slug = generateSlug(productData.name)
    if (images !== undefined) payload.images = normalizeProductImagesForDb(images)
    if (Object.keys(productData).length > 0 || images !== undefined) {
      await product.update(payload as Parameters<typeof product.update>[0], { transaction: t })
    }

    const variantUpdates: Record<string, unknown> = {}
    if (sku !== undefined)            variantUpdates.sku            = formatSku(sku)
    if (barcode !== undefined)        variantUpdates.barcode        = barcode
    if (cost_price !== undefined)     variantUpdates.cost_price     = cost_price
    if (base_price !== undefined)     variantUpdates.base_price     = base_price
    if (stock_quantity !== undefined) variantUpdates.stock_quantity = stock_quantity
    if (manage_stock !== undefined)   variantUpdates.manage_stock   = manage_stock

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

export type ImportAction = 'create' | 'update' | 'upsert'

export type ImportResult = {
  created: number
  updated: number
  skipped: number
  errors: { row: number; message: string }[]
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
): Promise<ImportResult> {
  const IMPORT_BATCH_SIZE = 1000
  const enriched = enrichMappedRowsFromCommonExports(rawRows, mappedRows)
  const mappedRowsEffective = enriched.map((row) => applyRowImportDefaults(row, importDefaults))

  if (usesHierarchicalProductImport(mappedRowsEffective)) {
    return importProductsHierarchical(
      rawRows,
      mappedRowsEffective,
      columnMapping,
      action,
      ctx,
      actorId,
      importSource,
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

  for (let start = 0; start < mappedRowsEffective.length; start += IMPORT_BATCH_SIZE) {
    const end = Math.min(start + IMPORT_BATCH_SIZE, mappedRowsEffective.length)
    await sequelize.transaction(async (t) => {
      for (let i = start; i < end; i++) {
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
        const rowUpdate = rowToProductUpdateInput(normalized, categoryId)
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
          const { productId, variantId } = await createProductFromImport(parsed.data, actorId, ctx, t, importOpts)
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
          await updateProductFromImport(existingVariant, parsed.data, actorId, t, importOpts)
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
          await updateProductFromImport(existingVariant, parsed.data, actorId, t, importOpts)
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
          const { productId, variantId } = await createProductFromImport(parsed.data, actorId, ctx, t, importOpts)
          created++
          await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, rowKey, productId, variantId, t)
        }
      }
    })
  }

  logger.info({ created, updated, skipped, actorId }, 'products imported')
  return { created, updated, skipped, errors }
}

async function createProductFromImport(
  input: ProductInput,
  actorId: string,
  ctx: TenantContext,
  transaction: Transaction,
  opts: { importSource: string; importExternalId: string | null },
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
      base_price: base_price ?? null,
      manage_stock: manage_stock ?? true,
      stock_quantity: stock_quantity ?? 0,
      import_external_id: opts.importExternalId,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )
  return { productId: product.id, variantId: variant.id }
}

async function updateProductFromImport(
  variant: ProductVariant,
  input: ProductUpdateInput,
  actorId: string,
  transaction: Transaction,
  opts?: { importSource?: string; importExternalId?: string | null },
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
  if (base_price !== undefined) variantUpdates.base_price = base_price
  if (stock_quantity !== undefined) variantUpdates.stock_quantity = stock_quantity
  if (manage_stock !== undefined) variantUpdates.manage_stock = manage_stock
  if (opts?.importExternalId !== undefined && opts.importExternalId !== null) {
    variantUpdates.import_external_id = opts.importExternalId
  }

  if (Object.keys(variantUpdates).length > 0) {
    await variant.update({ ...variantUpdates, updated_by: actorId }, { transaction })
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

export async function listProductsForSale(
  search: string | undefined,
  priceListId: string | undefined,
  limit: number,
  orgId: string,
  manageStock?: boolean,
): Promise<SaleProductOption[]> {
  const { getEffectivePrice } = await import('./price-list.service')

  const where: Record<string, unknown> = { org_id: orgId, status: 'active' }
  if (search) {
    where[Op.or as unknown as string] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { '$variants.sku$': { [Op.iLike]: `%${search}%` } },
    ]
  }

  const variantWhere: Record<string, unknown> = { is_default: true }
  if (manageStock !== undefined) variantWhere.manage_stock = manageStock

  const rows = await Product.findAll({
    where,
    limit,
    subQuery: false,
    order: [['name', 'ASC']],
    attributes: ['id', 'name', 'iva_rate', 'unit_of_measure'],
    include: [{
      model: ProductVariant,
      as: 'variants',
      where: variantWhere,
      required: true,
      attributes: ['id', 'sku', 'base_price'],
    }],
  })

  return Promise.all(
    rows.map(async (row) => {
      const variants = row.get('variants') as ProductVariant[]
      const variant = variants[0]

      let price = (variant?.base_price as string | null) ?? '0.00'
      if (priceListId && variant?.id) {
        const listPrice = await getEffectivePrice(priceListId, variant.id, orgId)
        if (listPrice !== null) price = listPrice
      }

      return {
        product_id:      row.id,
        variant_id:      variant.id,
        name:            row.name,
        sku:             variant.get('sku') as string,
        iva_rate:        row.get('iva_rate') as string,
        unit_of_measure: row.get('unit_of_measure') as string,
        price,
      }
    }),
  )
}
