import 'server-only'
import type { Transaction } from 'sequelize'
import sequelize from '@/lib/db'
import Product from './product.model'
import ProductCategory from './product-category.model'
import ProductVariant from './product-variant.model'
import { persistUnmappedCsvColumns } from './catalog-import-persist'
import { syncImportedPriceToDefaultList } from './catalog-import-price-list'
import { allocateUniqueVariantSku } from './allocate-variant-sku'
import { formatSku, normalizeProductImagesForDb, slugForImportedProduct, importBasePrice } from './product.utils'
import { resolveOrCreateCategoryIdForImport } from './catalog-import-category'
import { productSchema, productUpdateSchema } from './product.schema'
import type { ProductInput, ProductUpdateInput } from './product.schema'
import type { TenantContext } from '@/lib/tenancy'
import { whereOrg } from '@/lib/tenancy'
import logger from '@/lib/logger'
import type { ImportAction, ImportResult } from './products.service'
import type { ImportProgressCallback } from '@/lib/import-progress'
import { createImportProgressReporter } from '@/lib/import-progress'
import {
  mappedRowToNormalizedProductRow,
  parseProductCsvImages,
  usesHierarchicalProductImport,
  importRowCatalogKind,
  rowToProductInput,
  rowToProductUpdateInput,
} from './products-csv-adapter'

export { usesHierarchicalProductImport }

function mergeParentAndFirstChildMapped(
  parentMapped: Record<string, string>,
  firstMapped: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...parentMapped }
  const takeFromChildFirst = new Set([
    'sku',
    'base_price',
    'cost_price',
    'barcode',
    'manage_stock',
    'stock_quantity',
  ])
  for (const k of takeFromChildFirst) {
    if ((firstMapped[k] ?? '').trim() !== '') out[k] = firstMapped[k]!
  }
  if (!(out.name ?? '').trim() && (firstMapped.name ?? '').trim()) out.name = firstMapped.name!
  out.sale_price = firstMapped.sale_price || parentMapped.sale_price || ''
  out.catalog_published = parentMapped.catalog_published || firstMapped.catalog_published || ''
  return out
}

function buildProductInput(
  normalized: ReturnType<typeof mappedRowToNormalizedProductRow>,
  categoryId: string | undefined,
  images: Array<{ url: string; alt: null; position: number }>,
): ProductInput {
  const input = rowToProductInput(normalized, categoryId)
  if (images.length > 0) input.images = images
  return input
}

function buildProductUpdate(
  normalized: ReturnType<typeof mappedRowToNormalizedProductRow>,
  categoryId: string | undefined,
  images: Array<{ url: string; alt: null; position: number }>,
  mapped?: Record<string, string>,
): ProductUpdateInput {
  const input = rowToProductUpdateInput(normalized, categoryId, {
    priceMapped: mapped ? 'base_price' in mapped : undefined,
  })
  if (images.length > 0) input.images = images
  return input
}

async function createProductHierarchical(
  input: ProductInput,
  productExternalId: string,
  defaultVariantExternalId: string,
  importSource: string,
  actorId: string,
  ctx: TenantContext,
  transaction: Transaction,
): Promise<{ productId: string; variantId: string }> {
  const { sku, barcode, cost_price, base_price, manage_stock, stock_quantity, images, ...productData } = input
  const slug = slugForImportedProduct(productData.name, productExternalId)
  const product = await Product.create(
    {
      ...productData,
      images: normalizeProductImagesForDb(images),
      slug,
      org_id: ctx.orgId,
      import_source: importSource,
      import_external_id: productExternalId,
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
      import_external_id: defaultVariantExternalId,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction },
  )
  await syncImportedPriceToDefaultList(ctx.orgId, variant.id, base_price, actorId, transaction)
  return { productId: product.id, variantId: variant.id }
}

async function updateProductHierarchical(
  product: Product,
  variant: ProductVariant,
  input: ProductUpdateInput,
  sku: string,
  variantExternalId: string,
  importSource: string,
  actorId: string,
  ctx: TenantContext,
  transaction: Transaction,
) {
  const { barcode, cost_price, base_price, stock_quantity, manage_stock, images, ...productData } = input
  const slug = productData.name
    ? slugForImportedProduct(productData.name as string, product.import_external_id ?? '')
    : undefined
  await product.update(
    {
      ...productData,
      ...(images !== undefined ? { images: normalizeProductImagesForDb(images) } : {}),
      ...(slug ? { slug } : {}),
      import_source: importSource,
      import_external_id: product.import_external_id,
      updated_by: actorId,
    },
    { transaction },
  )
  await variant.update(
    {
      sku: formatSku(sku),
      barcode: barcode ?? variant.barcode,
      cost_price: cost_price ?? variant.cost_price,
      base_price: base_price !== undefined ? importBasePrice(base_price) : importBasePrice(variant.base_price),
      stock_quantity: stock_quantity ?? variant.stock_quantity,
      manage_stock: manage_stock ?? variant.manage_stock,
      import_external_id: variantExternalId,
      updated_by: actorId,
    },
    { transaction },
  )
  await syncImportedPriceToDefaultList(
    ctx.orgId,
    variant.id,
    base_price !== undefined ? importBasePrice(base_price) : importBasePrice(variant.base_price),
    actorId,
    transaction,
  )
}

export async function importProductsHierarchical(
  rawRows: Record<string, string>[],
  mappedRows: Record<string, string>[],
  columnMapping: Record<string, string>,
  action: ImportAction,
  ctx: TenantContext,
  actorId: string,
  importSource: string,
  onProgress?: ImportProgressCallback,
): Promise<ImportResult> {
  const errors: ImportResult['errors'] = []
  let created = 0
  let updated = 0
  let skipped = 0
  const total = mappedRows.length
  const progress = createImportProgressReporter(total, onProgress)
  const completedRows = new Set<number>()
  const completeRow = (index: number) => {
    if (index < 0 || index >= total || completedRows.has(index)) return
    completedRows.add(index)
    progress.tick(completedRows.size)
  }

  const categories = await ProductCategory.findAll({
    where: whereOrg(ctx),
    attributes: ['id', 'name'],
  })
  const categoryByName = new Map<string, string>(
    categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
  )

  await sequelize.transaction(async (t) => {
    const byExternalId = new Map<string, { mapped: Record<string, string>; raw: Record<string, string>; rowNum: number; index: number }>()
    const variationsByParent = new Map<string, { mapped: Record<string, string>; raw: Record<string, string>; rowNum: number; index: number }[]>()

    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i]!
      const raw = rawRows[i]!
      const rowNum = i + 2
      const ext = (mapped.catalog_external_id ?? '').trim()
      if (!ext) {
        errors.push({ row: rowNum, message: 'catalog_external_id: requerido en importación jerárquica' })
        completeRow(i)
        continue
      }
      byExternalId.set(ext, { mapped, raw, rowNum, index: i })
      const typ = importRowCatalogKind(mapped)
      if (typ === 'variation') {
        const parent = (mapped.catalog_parent_id ?? '').trim()
        if (!parent) {
          errors.push({ row: rowNum, message: 'catalog_parent_id: requerido para filas variation' })
          completeRow(i)
          continue
        }
        const list = variationsByParent.get(parent) ?? []
        list.push({ mapped, raw, rowNum, index: i })
        variationsByParent.set(parent, list)
      }
    }

    const processedExtIds = new Set<string>()

    async function upsertOneProductOneDefaultVariant(
      mapped: Record<string, string>,
      raw: Record<string, string>,
      rowNum: number,
      productExtId: string,
      variantExtId: string,
    ) {
      const normalized = mappedRowToNormalizedProductRow(mapped)
      const categoryId = normalized.category_name
        ? await resolveOrCreateCategoryIdForImport(normalized.category_name, categoryByName, ctx, actorId, t)
        : undefined
      const images = parseProductCsvImages(mapped.images_urls ?? '')
      const sku = await allocateUniqueVariantSku(ctx, normalized.sku, variantExtId, t)
      normalized.sku = sku

      const existingProduct = await Product.findOne({
        where: {
          ...whereOrg(ctx),
          import_source: importSource,
          import_external_id: productExtId,
        },
        transaction: t,
      })

      if (action === 'create' && existingProduct) {
        skipped++
        return
      }
      if (action === 'update' && !existingProduct) {
        skipped++
        return
      }

      const input = buildProductInput(normalized, categoryId, images)

      if (action === 'create' || (action === 'upsert' && !existingProduct)) {
        const parsed = productSchema.safeParse(input)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          return
        }
        const { productId, variantId } = await createProductHierarchical(
          parsed.data,
          productExtId,
          variantExtId,
          importSource,
          actorId,
          ctx,
          t,
        )
        created++
        await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, variantExtId, productId, variantId, t)
        processedExtIds.add(productExtId)
        processedExtIds.add(variantExtId)
        return
      }

      if (existingProduct) {
        const defaultVar = await ProductVariant.findOne({
          where: { ...whereOrg(ctx), product_id: existingProduct.id, is_default: true },
          transaction: t,
        })
        if (!defaultVar) {
          errors.push({ row: rowNum, message: 'variante default no encontrada' })
          return
        }
        const upd = buildProductUpdate(normalized, categoryId, images, mapped)
        const parsed = productUpdateSchema.safeParse(upd)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: rowNum, message: msgs })
          return
        }
        await updateProductHierarchical(
          existingProduct,
          defaultVar,
          parsed.data,
          sku,
          variantExtId,
          importSource,
          actorId,
          ctx,
          t,
        )
        updated++
        await persistUnmappedCsvColumns(raw, columnMapping, importSource, ctx.orgId, variantExtId, existingProduct.id, defaultVar.id, t)
        processedExtIds.add(productExtId)
        processedExtIds.add(variantExtId)
      }
    }

    async function upsertVariableGroup(
      parentMapped: Record<string, string>,
      parentRaw: Record<string, string>,
      parentRowNum: number,
      parentExt: string,
      children: { mapped: Record<string, string>; raw: Record<string, string>; rowNum: number; index: number }[],
    ) {
      children.sort((a, b) => {
        const pa = Number.parseInt((a.mapped.catalog_position ?? '').trim(), 10)
        const pb = Number.parseInt((b.mapped.catalog_position ?? '').trim(), 10)
        if (!Number.isNaN(pa) && !Number.isNaN(pb)) return pa - pb
        return a.rowNum - b.rowNum
      })

      const parentNorm = mappedRowToNormalizedProductRow(parentMapped)
      const categoryId = parentNorm.category_name
        ? await resolveOrCreateCategoryIdForImport(parentNorm.category_name, categoryByName, ctx, actorId, t)
        : undefined
      const parentImages = parseProductCsvImages(parentMapped.images_urls ?? '')

      let product = await Product.findOne({
        where: { ...whereOrg(ctx), import_source: importSource, import_external_id: parentExt },
        transaction: t,
      })

      if (action === 'create' && product) {
        skipped++
        for (const ch of children) {
          processedExtIds.add((ch.mapped.catalog_external_id ?? '').trim())
        }
        processedExtIds.add(parentExt)
        return
      }
      if (action === 'update' && !product) {
        skipped++
        return
      }

      const first = children[0]!
      const firstNorm = mappedRowToNormalizedProductRow(first.mapped)
      const firstImages = parseProductCsvImages(first.mapped.images_urls ?? '')
      const images = parentImages.length > 0 ? parentImages : firstImages
      const displayName = parentNorm.name || firstNorm.name
      if (!displayName) {
        errors.push({ row: parentRowNum, message: 'name: requerido (padre o primera variante)' })
        return
      }

      const mergedMapped = mergeParentAndFirstChildMapped(parentMapped, first.mapped)
      const mergedNorm = mappedRowToNormalizedProductRow(mergedMapped)
      mergedNorm.name = displayName
      const child0Ext = (first.mapped.catalog_external_id ?? '').trim()
      const sku0 = await allocateUniqueVariantSku(ctx, mergedNorm.sku, child0Ext, t)
      mergedNorm.sku = sku0
      const createInput = buildProductInput(mergedNorm, categoryId, images)

      if (!product && (action === 'create' || action === 'upsert')) {
        const parsed = productSchema.safeParse(createInput)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: parentRowNum, message: msgs })
          return
        }
        const { productId, variantId } = await createProductHierarchical(
          parsed.data,
          parentExt,
          child0Ext,
          importSource,
          actorId,
          ctx,
          t,
        )
        product = (await Product.findByPk(productId, { transaction: t }))!
        created++
        await persistUnmappedCsvColumns(parentRaw, columnMapping, importSource, ctx.orgId, parentExt, productId, variantId, t)
        await persistUnmappedCsvColumns(first.raw, columnMapping, importSource, ctx.orgId, child0Ext, productId, variantId, t)
        processedExtIds.add(parentExt)
        processedExtIds.add(child0Ext)

        for (let i = 1; i < children.length; i++) {
          const ch = children[i]!
          const chExt = (ch.mapped.catalog_external_id ?? '').trim()
          const chNorm = mappedRowToNormalizedProductRow(ch.mapped)
          const chSku = await allocateUniqueVariantSku(ctx, chNorm.sku, chExt, t)
          await ProductVariant.create(
            {
              product_id: product.id,
              org_id: ctx.orgId,
              sku: chSku,
              barcode: chNorm.barcode || null,
              name: chNorm.name && chNorm.name !== displayName ? chNorm.name.slice(0, 255) : null,
              is_default: false,
              cost_price: chNorm.cost_price || null,
              base_price: importBasePrice(chNorm.base_price),
              manage_stock: parseManage(chNorm.manage_stock),
              stock_quantity: parseStock(chNorm.stock_quantity),
              import_external_id: chExt,
              created_by: actorId,
              updated_by: actorId,
            },
            { transaction: t },
          )
          const newV = await ProductVariant.findOne({
            where: { ...whereOrg(ctx), product_id: product.id, import_external_id: chExt },
            transaction: t,
          })
          if (newV?.id) {
            await syncImportedPriceToDefaultList(ctx.orgId, newV.id, importBasePrice(chNorm.base_price), actorId, t)
          }
          await persistUnmappedCsvColumns(
            ch.raw,
            columnMapping,
            importSource,
            ctx.orgId,
            chExt,
            product.id,
            newV?.id ?? null,
            t,
          )
          processedExtIds.add(chExt)
        }
        return
      }

      if (product && (action === 'update' || action === 'upsert')) {
        const upd = buildProductUpdate(parentNorm, categoryId, parentImages, parentMapped)
        upd.name = displayName
        const parsed = productUpdateSchema.safeParse(upd)
        if (!parsed.success) {
          const msgs = parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join(', ')
          errors.push({ row: parentRowNum, message: msgs })
          return
        }
        const { images: updImages, ...updRest } = parsed.data
        await product.update(
          {
            ...updRest,
            ...(updImages !== undefined ? { images: normalizeProductImagesForDb(updImages) } : {}),
            slug: slugForImportedProduct(displayName, parentExt),
            import_source: importSource,
            import_external_id: parentExt,
            updated_by: actorId,
          } as Parameters<typeof product.update>[0],
          { transaction: t },
        )
        for (const ch of children) {
          const chExt = (ch.mapped.catalog_external_id ?? '').trim()
          const chNorm = mappedRowToNormalizedProductRow(ch.mapped)
          const chSku = await allocateUniqueVariantSku(ctx, chNorm.sku, chExt, t)
          let v = await ProductVariant.findOne({
            where: { ...whereOrg(ctx), product_id: product.id, import_external_id: chExt },
            transaction: t,
          })
          if (!v) {
            v = await ProductVariant.findOne({
              where: { ...whereOrg(ctx), product_id: product.id, sku: chSku },
              transaction: t,
            })
          }
          if (!v) {
            await ProductVariant.create(
              {
                product_id: product.id,
                org_id: ctx.orgId,
                sku: chSku,
                barcode: chNorm.barcode || null,
                name: chNorm.name && chNorm.name !== displayName ? chNorm.name.slice(0, 255) : null,
                is_default: false,
                cost_price: chNorm.cost_price || null,
                base_price: importBasePrice(chNorm.base_price),
                manage_stock: parseManage(chNorm.manage_stock),
                stock_quantity: parseStock(chNorm.stock_quantity),
                import_external_id: chExt,
                created_by: actorId,
                updated_by: actorId,
              },
              { transaction: t },
            )
          } else {
            await v.update(
              {
                sku: chSku,
                barcode: chNorm.barcode || v.barcode,
                name: chNorm.name && chNorm.name !== displayName ? chNorm.name.slice(0, 255) : v.name,
                cost_price: chNorm.cost_price ?? v.cost_price,
                base_price: chNorm.base_price !== undefined ? importBasePrice(chNorm.base_price) : importBasePrice(v.base_price),
                manage_stock: parseManage(chNorm.manage_stock) ?? v.manage_stock,
                stock_quantity: parseStock(chNorm.stock_quantity) ?? v.stock_quantity,
                import_external_id: chExt,
                updated_by: actorId,
              },
              { transaction: t },
            )
          }
          const vFinal = await ProductVariant.findOne({
            where: { ...whereOrg(ctx), product_id: product.id, import_external_id: chExt },
            transaction: t,
          })
          if (vFinal?.id) {
            await syncImportedPriceToDefaultList(ctx.orgId, vFinal.id, importBasePrice(chNorm.base_price), actorId, t)
          }
          await persistUnmappedCsvColumns(ch.raw, columnMapping, importSource, ctx.orgId, chExt, product.id, vFinal?.id ?? null, t)
          processedExtIds.add(chExt)
        }
        await persistUnmappedCsvColumns(parentRaw, columnMapping, importSource, ctx.orgId, parentExt, product.id, null, t)
        processedExtIds.add(parentExt)
        updated++
      }
    }

    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i]!
      const raw = rawRows[i]!
      const rowNum = i + 2
      const ext = (mapped.catalog_external_id ?? '').trim()
      const typ = importRowCatalogKind(mapped)
      if (!ext || processedExtIds.has(ext)) {
        completeRow(i)
        continue
      }
      if (typ === 'variation') continue

      if (typ === 'variable') {
        const children = variationsByParent.get(ext) ?? []
        if (children.length === 0) {
          await upsertOneProductOneDefaultVariant(mapped, raw, rowNum, ext, ext)
        } else {
          await upsertVariableGroup(mapped, raw, rowNum, ext, children)
        }
        completeRow(i)
        for (const ch of children) completeRow(ch.index)
        continue
      }

      if (typ === 'simple' || typ === '') {
        await upsertOneProductOneDefaultVariant(mapped, raw, rowNum, ext, ext)
        completeRow(i)
      }
    }

    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i]!
      const raw = rawRows[i]!
      const rowNum = i + 2
      const ext = (mapped.catalog_external_id ?? '').trim()
      const typ = importRowCatalogKind(mapped)
      if (typ !== 'variation' || processedExtIds.has(ext)) {
        completeRow(i)
        continue
      }
      const parent = (mapped.catalog_parent_id ?? '').trim()
      const parentEntry = parent ? byExternalId.get(parent) : undefined
      if (parentEntry && importRowCatalogKind(parentEntry.mapped) === 'variable') {
        completeRow(i)
        continue
      }
      await upsertOneProductOneDefaultVariant(mapped, raw, rowNum, ext, ext)
      completeRow(i)
    }
  })

  progress.finish()
  logger.info({ created, updated, skipped, actorId }, 'products imported (hierarchical)')
  return { created, updated, skipped, errors }
}

function parseManage(s: string): boolean {
  const v = s.trim().toLowerCase()
  if (['false', '0', 'no'].includes(v)) return false
  return true
}

function parseStock(s: string): number {
  const n = Number.parseInt(s.trim(), 10)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}
