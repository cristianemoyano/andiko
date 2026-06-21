import Contact from '@/modules/contacts/contact.model'
import ProductCategory from '@/modules/catalog/product-category.model'
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import PriceList from '@/modules/catalog/price-list.model'
import PriceListItem from '@/modules/catalog/price-list-item.model'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import Account from '@/modules/accounting/account.model'
import JournalEntry from '@/modules/accounting/journal-entry.model'
import JournalEntryLine from '@/modules/accounting/journal-entry-line.model'
import { nextEntryNumber } from '@/modules/accounting/accounting.utils'
import { calcLineItem, calcDocumentTotals, nextDocumentNumber } from '@/modules/sales/sales.utils'
import type { IvaRate } from '@/types'
import type Branch from '@/modules/auth/branch.model'
import { slugifyText } from '@/lib/slug'
import {
  INTEGRATION_CUSTOMERS,
  INTEGRATION_PRODUCTS,
  INTEGRATION_SUPPLIERS,
} from './integration-seed-data'

/** findOrCreate ignores soft-deleted rows but the unique (slug, org_id) still blocks INSERT. */
async function findOrRestoreProduct(
  orgId: string,
  slug: string,
  defaults: Parameters<typeof Product.create>[0],
  t: import('sequelize').Transaction,
): Promise<Product> {
  const existing = await Product.findOne({
    where: { org_id: orgId, slug },
    paranoid: false,
    transaction: t,
  })
  if (existing) {
    if (existing.deleted_at) {
      await existing.restore({ transaction: t })
      await existing.update({ status: 'active', updated_by: defaults.updated_by }, { transaction: t })
    }
    return existing
  }
  return Product.create(defaults, { transaction: t })
}

async function findOrRestoreVariant(
  orgId: string,
  sku: string,
  defaults: Parameters<typeof ProductVariant.create>[0],
  t: import('sequelize').Transaction,
): Promise<ProductVariant> {
  const existing = await ProductVariant.findOne({
    where: { org_id: orgId, sku },
    paranoid: false,
    transaction: t,
  })
  if (existing) {
    if (existing.deleted_at) {
      await existing.restore({ transaction: t })
    }
    return existing
  }
  return ProductVariant.create(defaults, { transaction: t })
}

export async function seedIntegrationContacts(
  orgId: string,
  actorId: string,
  t: import('sequelize').Transaction,
): Promise<Contact[]> {
  const seeded: Contact[] = []

  for (const supplier of INTEGRATION_SUPPLIERS) {
    const [contact] = await Contact.findOrCreate({
      where: { org_id: orgId, legal_name: supplier.legal_name },
      defaults: {
        org_id: orgId,
        type: 'supplier',
        legal_name: supplier.legal_name,
        trade_name: supplier.trade_name,
        cuit: supplier.cuit,
        iva_condition: 'responsable_inscripto',
        email: supplier.email,
        phone: supplier.phone,
        notes: 'integration-seed',
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    seeded.push(contact)
  }

  for (const customer of INTEGRATION_CUSTOMERS) {
    const [contact] = await Contact.findOrCreate({
      where: { org_id: orgId, legal_name: customer.legal_name },
      defaults: {
        org_id: orgId,
        type: 'customer',
        legal_name: customer.legal_name,
        trade_name: customer.trade_name,
        cuit: customer.cuit,
        iva_condition: 'responsable_inscripto',
        email: customer.email,
        phone: customer.phone,
        notes: 'integration-seed',
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    seeded.push(contact)
  }

  return seeded
}

export async function seedIntegrationCatalog(
  orgId: string,
  actorId: string,
  t: import('sequelize').Transaction,
): Promise<Map<string, ProductVariant>> {
  const categories = new Map<string, ProductCategory>()
  const categoryNames = [...new Set(INTEGRATION_PRODUCTS.map((p) => p.category))]

  for (const name of categoryNames) {
    const slug = slugifyText(name)
    const [category] = await ProductCategory.findOrCreate({
      where: { org_id: orgId, slug },
      defaults: {
        org_id: orgId,
        parent_id: null,
        name,
        slug,
        description: `${name} (integration seed)`,
        status: 'active',
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    categories.set(slug, category)
  }

  const variantsBySku = new Map<string, ProductVariant>()

  for (const productSeed of INTEGRATION_PRODUCTS) {
    const slug = slugifyText(productSeed.name)
    const category = categories.get(productSeed.categorySlug)
    const productDefaults = {
      org_id: orgId,
      category_id: category?.id ?? null,
      name: productSeed.name,
      slug,
      description: null,
      short_description: null,
      product_type: 'simple' as const,
      status: 'active' as const,
      vendor: null,
      iva_rate: '21' as const,
      unit_of_measure: productSeed.unit,
      ncm_code: null,
      tags: [] as string[],
      images: [] as string[],
      created_by: actorId,
      updated_by: actorId,
    }
    const product = await findOrRestoreProduct(orgId, slug, productDefaults, t)

    const variantDefaults = {
      org_id: orgId,
      product_id: product.id,
      sku: productSeed.sku,
      barcode: null,
      name: null,
      is_default: true,
      cost_price: productSeed.costPrice,
      base_price: productSeed.salePrice,
      manage_stock: true,
      stock_quantity: productSeed.stock,
      created_by: actorId,
      updated_by: actorId,
    }
    const variant = await findOrRestoreVariant(orgId, productSeed.sku, variantDefaults, t)

    if (Number(variant.stock_quantity) !== productSeed.stock) {
      await variant.update(
        { stock_quantity: productSeed.stock, updated_by: actorId },
        { transaction: t },
      )
    }

    variantsBySku.set(productSeed.sku, variant)
  }

  const [priceList] = await PriceList.findOrCreate({
    where: { org_id: orgId, name: 'Lista General' },
    defaults: {
      org_id: orgId,
      name: 'Lista General',
      description: 'Lista base integration seed',
      is_default: true,
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
    },
    transaction: t,
  })

  if (!priceList.is_default) {
    await priceList.update({ is_default: true, updated_by: actorId }, { transaction: t })
  }

  for (const productSeed of INTEGRATION_PRODUCTS) {
    const variant = variantsBySku.get(productSeed.sku)
    if (!variant) continue

    await PriceListItem.findOrCreate({
      where: { org_id: orgId, price_list_id: priceList.id, product_variant_id: variant.id },
      defaults: {
        org_id: orgId,
        price_list_id: priceList.id,
        product_variant_id: variant.id,
        price: productSeed.salePrice,
        valid_from: new Date(),
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
  }

  const [wholesaleList] = await PriceList.findOrCreate({
    where: { org_id: orgId, name: 'Mayoristas' },
    defaults: {
      org_id: orgId,
      name: 'Mayoristas',
      description: 'Lista mayorista integration seed',
      is_default: false,
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
    },
    transaction: t,
  })

  for (const productSeed of INTEGRATION_PRODUCTS.filter((p) => p.sku === 'RES-001' || p.sku === 'CAT-001')) {
    const variant = variantsBySku.get(productSeed.sku)
    if (!variant) continue
    const wholesalePrice = productSeed.sku === 'RES-001' ? '220.00' : '100.00'
    await PriceListItem.findOrCreate({
      where: { org_id: orgId, price_list_id: wholesaleList.id, product_variant_id: variant.id },
      defaults: {
        org_id: orgId,
        price_list_id: wholesaleList.id,
        product_variant_id: variant.id,
        price: wholesalePrice,
        valid_from: new Date(),
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
  }

  return variantsBySku
}

const INTEGRATION_CUSTOMER_INVOICE_TOTALS: Record<string, string> = {
  'Cliente XYZ': '500.00',
  'Distribuidora ABC': '300.00',
  'Cliente ABC': '200.00',
}

async function seedPendingInvoiceForCustomer(
  orgId: string,
  branch: Branch,
  actorId: string,
  customerId: string,
  targetTotal: string,
  variantsBySku: Map<string, ProductVariant>,
  t: import('sequelize').Transaction,
): Promise<void> {
  const existing = await Invoice.findOne({
    where: { org_id: orgId, contact_id: customerId, notes: 'Factura pendiente integration seed' },
    transaction: t,
  })
  if (existing) return

  const iva_rate: IvaRate = '21'
  const variant = variantsBySku.get('RES-001')
  const line = {
    product_id: variant?.product_id ?? null,
    variant_id: variant?.id ?? null,
    description: 'Resina Epóxica',
    quantity: '2',
    unit_price: '206.61',
    discount_pct: '0.00',
    iva_rate,
    sort_order: 0,
  }
  const lineTotal = calcLineItem(line.quantity, line.unit_price, line.discount_pct, line.iva_rate)
  const docTotals = calcDocumentTotals([lineTotal])

  const order_number = await nextDocumentNumber(orgId, branch.id, 'order', t)
  const order = await SalesOrder.create(
    {
      org_id: orgId,
      branch_id: branch.id,
      contact_id: customerId,
      quote_id: null,
      order_number,
      salesperson_id: actorId,
      status: 'confirmed',
      payment_condition: 'net_30',
      currency: 'ARS',
      promised_date: null,
      delivered_date: null,
      subtotal: docTotals.subtotal,
      discount_amount: docTotals.discount_amount,
      tax_amount: docTotals.tax_amount,
      total: targetTotal,
      notes: 'Pedido integration seed',
      internal_notes: null,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )

  await SalesOrderItem.create(
    {
      org_id: orgId,
      order_id: order.id,
      product_id: line.product_id,
      variant_id: line.variant_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_pct: line.discount_pct,
      iva_rate: line.iva_rate,
      subtotal: lineTotal.subtotal,
      discount_amount: lineTotal.discount_amount,
      tax_base: lineTotal.tax_base,
      tax_amount: lineTotal.tax_amount,
      total: targetTotal,
      sort_order: line.sort_order,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )

  const invoice_number = await nextDocumentNumber(orgId, branch.id, 'invoice', t)
  const invoice = await Invoice.create(
    {
      org_id: orgId,
      branch_id: branch.id,
      contact_id: customerId,
      order_id: order.id,
      quote_id: null,
      invoice_number,
      salesperson_id: actorId,
      status: 'issued',
      issue_date: new Date(),
      due_date: new Date('2026-07-15'),
      payment_condition: 'net_30',
      currency: 'ARS',
      subtotal: docTotals.subtotal,
      discount_amount: docTotals.discount_amount,
      tax_amount: docTotals.tax_amount,
      total: targetTotal,
      paid_amount: '0.00',
      balance: targetTotal,
      notes: 'Factura pendiente integration seed',
      internal_notes: null,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )

  await InvoiceItem.create(
    {
      org_id: orgId,
      invoice_id: invoice.id,
      product_id: line.product_id,
      variant_id: line.variant_id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      discount_pct: line.discount_pct,
      iva_rate: line.iva_rate,
      subtotal: lineTotal.subtotal,
      discount_amount: lineTotal.discount_amount,
      tax_base: lineTotal.tax_base,
      tax_amount: lineTotal.tax_amount,
      total: targetTotal,
      sort_order: line.sort_order,
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )
}

export async function seedIntegrationFinancials(
  orgId: string,
  branch: Branch,
  actorId: string,
  contacts: Contact[],
  variantsBySku: Map<string, ProductVariant>,
  t: import('sequelize').Transaction,
): Promise<void> {
  const customers = contacts.filter((contact) =>
    INTEGRATION_CUSTOMERS.some((seed) => seed.legal_name === contact.legal_name),
  )

  for (const customer of customers) {
    const targetTotal = INTEGRATION_CUSTOMER_INVOICE_TOTALS[customer.legal_name] ?? '500.00'
    await seedPendingInvoiceForCustomer(
      orgId,
      branch,
      actorId,
      customer.id,
      targetTotal,
      variantsBySku,
      t,
    )
  }
}

export async function seedIntegrationAccounting(
  orgId: string,
  actorId: string,
  t: import('sequelize').Transaction,
): Promise<void> {
  const existing = await JournalEntry.findOne({
    where: { org_id: orgId, description: 'Integration seed balance sheet' },
    transaction: t,
  })
  if (existing) return

  const accountRows = await Account.findAll({
    where: { org_id: orgId },
    attributes: ['id', 'code'],
    transaction: t,
  })
  const idByCode = new Map(accountRows.map((account) => [account.code, account.id]))
  const acc = (code: string): string => {
    const id = idByCode.get(code)
    if (!id) throw new Error(`Seed contable integration: cuenta ${code} no encontrada`)
    return id
  }

  const lines = [
    { code: '1.1.01.02', debit: '250000.00', credit: '0.00', description: 'Banco' },
    { code: '2.1.01.01', debit: '0.00', credit: '100000.00', description: 'Proveedores' },
    { code: '3.1.01', debit: '0.00', credit: '150000.00', description: 'Capital social' },
  ]

  const entry_number = await nextEntryNumber(orgId, t)
  const totalDebit = lines.reduce((sum, line) => sum + parseFloat(line.debit), 0)
  const totalCredit = lines.reduce((sum, line) => sum + parseFloat(line.credit), 0)

  const entry = await JournalEntry.create(
    {
      org_id: orgId,
      entry_number,
      entry_date: new Date('2026-06-15'),
      description: 'Integration seed balance sheet',
      status: 'posted',
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      created_by: actorId,
      updated_by: actorId,
    },
    { transaction: t },
  )

  await JournalEntryLine.bulkCreate(
    lines.map((line, idx) => ({
      org_id: orgId,
      entry_id: entry.id,
      account_id: acc(line.code),
      branch_id: null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      sort_order: idx,
      created_by: actorId,
      updated_by: actorId,
    })),
    { transaction: t },
  )
}
