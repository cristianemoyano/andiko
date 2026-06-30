import 'server-only'
import { Op, type Transaction } from 'sequelize'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'

export type SaleLineItemRef = {
  product_id?: string | null
  variant_id?: string | null
}

export class SaleLineItemValidationError extends Error {
  readonly code: 'SALE_LINE_PRODUCT_REQUIRED' | 'SALE_LINE_PRODUCT_NOT_SALEABLE' | 'SALE_LINE_PRODUCT_MISMATCH'

  readonly line: number

  constructor(
    code: SaleLineItemValidationError['code'],
    message: string,
    line: number,
  ) {
    super(message)
    this.name = 'SaleLineItemValidationError'
    this.code = code
    this.line = line
  }
}

/** Cada línea debe referenciar una variante de producto activo en la organización. */
export async function assertSaleLineItemsFromActiveCatalog(
  items: SaleLineItemRef[],
  orgId: string,
  transaction?: Transaction,
): Promise<void> {
  if (items.length === 0) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (!item.product_id?.trim() || !item.variant_id?.trim()) {
      throw new SaleLineItemValidationError(
        'SALE_LINE_PRODUCT_REQUIRED',
        `La línea ${i + 1} debe tener un producto del catálogo.`,
        i + 1,
      )
    }
  }

  const variantIds = [...new Set(items.map((item) => item.variant_id!.trim()))]
  const variants = await ProductVariant.findAll({
    where: { id: { [Op.in]: variantIds }, org_id: orgId },
    attributes: ['id', 'product_id'],
    include: [{
      model: Product,
      as: 'product',
      required: true,
      attributes: ['id', 'status'],
      where: { org_id: orgId, status: 'active' },
    }],
    transaction,
  })

  const variantById = new Map(variants.map((v) => [v.id, v]))

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const variant = variantById.get(item.variant_id!.trim())
    if (!variant) {
      throw new SaleLineItemValidationError(
        'SALE_LINE_PRODUCT_NOT_SALEABLE',
        `La línea ${i + 1} referencia un producto inexistente o no disponible para venta.`,
        i + 1,
      )
    }
    if (variant.product_id !== item.product_id!.trim()) {
      throw new SaleLineItemValidationError(
        'SALE_LINE_PRODUCT_MISMATCH',
        `La línea ${i + 1} no coincide con la variante del catálogo.`,
        i + 1,
      )
    }
  }
}
