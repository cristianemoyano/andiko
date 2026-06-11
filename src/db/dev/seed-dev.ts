import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'
import Contact from '@/modules/contacts/contact.model'
import ContactAddress from '@/modules/contacts/contact-address.model'
import Organization from '@/modules/auth/organization.model'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import { BASE_PLAN_ENABLED_MODULES } from '@/modules/auth/organization-modules'
import Branch from '@/modules/auth/branch.model'
import User from '@/modules/auth/user.model'
import UserBranch from '@/modules/auth/user-branch.model'
import bcrypt from 'bcryptjs'
import SalesQuote from '@/modules/sales/sales-quote.model'
import SalesQuoteItem from '@/modules/sales/sales-quote-item.model'
import SalesOrder from '@/modules/sales/sales-order.model'
import SalesOrderItem from '@/modules/sales/sales-order-item.model'
import Invoice from '@/modules/sales/invoice.model'
import InvoiceItem from '@/modules/sales/invoice-item.model'
import Payment from '@/modules/sales/payment.model'
import { calcLineItem, calcDocumentTotals, nextDocumentNumber } from '@/modules/sales/sales.utils'
import type { IvaRate } from '@/types'
import ProductCategory from '@/modules/catalog/product-category.model'
import Product, { type ProductType, type IvaRate as ProductIvaRate, type UnitOfMeasure } from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import PriceList from '@/modules/catalog/price-list.model'
import PriceListItem from '@/modules/catalog/price-list-item.model'
import { slugifyText } from '@/lib/slug'
import Warehouse from '@/modules/inventory/warehouse.model'
import StockItem from '@/modules/inventory/stock-item.model'
import StockMovement from '@/modules/inventory/stock-movement.model'
import PurchaseOrder from '@/modules/purchases/purchase-order.model'
import PurchaseOrderItem from '@/modules/purchases/purchase-order-item.model'
import PurchaseReceipt from '@/modules/purchases/purchase-receipt.model'
import PurchaseReceiptItem from '@/modules/purchases/purchase-receipt-item.model'
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'
import SupplierInvoiceItem from '@/modules/purchases/supplier-invoice-item.model'
import SupplierPayment from '@/modules/purchases/supplier-payment.model'
import { nextPurchaseDocNumber, calcLineItem as calcPurchaseLine, calcDocumentTotals as calcPurchaseTotals } from '@/modules/purchases/purchases.utils'

const MIN_PROD_PASSWORD_LENGTH = 16

const DEV_SEED = {
  sysAdmin: {
    email: 'admin@andiko.local',
    password: 'password123',
    name: 'Sys Admin',
  },
  tenants: [
    {
      name: 'Demo SRL',
      slug: 'demo',
      branches: [
        { name: 'Casa Central', address: 'Av. Siempre Viva 123' },
        { name: 'Sucursal Norte', address: 'Ruta 9 km 12' },
      ],
      users: [
        { email: 'admin@demo.local', password: 'demo12345', name: 'Admin Demo', role: 'admin' as const, branchIndex: 0, allowedBranchIndexes: [0, 1] },
        { email: 'op@demo.local', password: 'demo12345', name: 'Operador Demo', role: 'operator' as const, branchIndex: 1, allowedBranchIndexes: [1] },
      ],
    },
    {
      name: 'Premium SA',
      slug: 'premium',
      branches: [{ name: 'Central', address: 'Mitre 100' }],
      users: [
        { email: 'admin@premium.local', password: 'premium12345', name: 'Admin Premium', role: 'admin' as const, branchIndex: 0, allowedBranchIndexes: [0] },
      ],
    },
  ],
} as const

type SeedConfig = {
  sysAdmin: { email: string; password: string; name: string }
  tenants: Array<{
    name: string
    slug: string
    branches: Array<{ name: string; address: string }>
    users: Array<{
      email: string
      password: string
      name: string
      role: 'admin' | 'operator'
      branchIndex: number
      allowedBranchIndexes: number[]
    }>
  }>
}

function requireProdPassword(envKey: string): string {
  const value = process.env[envKey]?.trim()
  if (!value || value.length < MIN_PROD_PASSWORD_LENGTH) {
    throw new Error(
      `Set ${envKey} in .env.production.local (min ${MIN_PROD_PASSWORD_LENGTH} chars) before pnpm db:seed-prod.`,
    )
  }
  return value
}

function buildSeedConfig(allowProd: boolean): SeedConfig {
  if (!allowProd) return DEV_SEED as unknown as SeedConfig

  const [demo, premium] = DEV_SEED.tenants
  return {
    sysAdmin: {
      ...DEV_SEED.sysAdmin,
      password: requireProdPassword('SEED_SYSADMIN_PASSWORD'),
    },
    tenants: [
      {
        name: demo.name,
        slug: demo.slug,
        branches: demo.branches.map((b) => ({ ...b })),
        users: [
          {
            ...demo.users[0],
            password: requireProdPassword('SEED_DEMO_ADMIN_PASSWORD'),
            allowedBranchIndexes: [...demo.users[0].allowedBranchIndexes],
          },
          {
            ...demo.users[1],
            password: requireProdPassword('SEED_DEMO_OPERATOR_PASSWORD'),
            allowedBranchIndexes: [...demo.users[1].allowedBranchIndexes],
          },
        ],
      },
      {
        name: premium.name,
        slug: premium.slug,
        branches: premium.branches.map((b) => ({ ...b })),
        users: [
          {
            ...premium.users[0],
            password: requireProdPassword('SEED_PREMIUM_ADMIN_PASSWORD'),
            allowedBranchIndexes: [...premium.users[0].allowedBranchIndexes],
          },
        ],
      },
    ],
  }
}

async function hashPassword(plaintext: string) {
  return bcrypt.hash(plaintext, 12)
}

async function ensurePermissionsSeeded(t: import('sequelize').Transaction) {
  const resources = ['contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting'] as const
  const actions = ['read', 'write', 'delete'] as const

  const permissions = resources.flatMap((r) =>
    actions.map((a) => ({
      name: `${r}:${a}`,
      resource: r,
      action: a,
      description: `${a.charAt(0).toUpperCase() + a.slice(1)} ${r}`,
    })),
  )

  const columnRows = await sequelize.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'permissions'
     ORDER BY ordinal_position`,
    { transaction: t, type: QueryTypes.SELECT },
  )
  const columns = new Set(columnRows.map((row) => row.column_name))
  const usesLegacyPermissions = columns.has('resource') && columns.has('action')

  // 1) Ensure permissions catalog exists
  for (const p of permissions) {
    if (usesLegacyPermissions) {
      await sequelize.query(
        `INSERT INTO permissions (id, name, resource, action, description, "updatedAt")
         VALUES (gen_random_uuid(), :name, :resource, :action, :description, NOW())
         ON CONFLICT (name) DO NOTHING`,
        { transaction: t, replacements: p },
      )
    } else {
      await sequelize.query(
        `INSERT INTO permissions (id, name, description)
         VALUES (gen_random_uuid(), :name, :description)
         ON CONFLICT (name) DO NOTHING`,
        { transaction: t, replacements: p },
      )
    }
  }

  // Legacy role_permissions (roleId/permissionId) — skip; not compatible with Andiko ERP seed.
  if (columns.has('createdAt') && !columns.has('created_at')) {
    return
  }

  // 2) Ensure global role defaults exist (org_id = NULL)
  const defaultsFor = (role: 'admin' | 'operator' | 'readonly') => {
    return permissions
      .map((p) => p.name)
      .filter((name) => {
        if (role === 'admin') return true
        if (role === 'readonly') return name.endsWith(':read')
        return name.endsWith(':read') || (name.endsWith(':write') && name !== 'accounting:write')
      })
  }

  for (const role of ['admin', 'operator', 'readonly'] as const) {
    for (const permName of defaultsFor(role)) {
      await sequelize.query(
        `INSERT INTO role_permissions (id, role, permission_id, org_id)
         SELECT gen_random_uuid(), :role, p.id, NULL
         FROM permissions p
         WHERE p.name = :name
         ON CONFLICT ON CONSTRAINT uq_role_permission_org DO NOTHING`,
        { transaction: t, replacements: { role, name: permName } },
      )
    }
  }
}

async function seedContacts(orgId: string, actorId: string, t: import('sequelize').Transaction) {
  const contactsSpec = [
    {
      type: 'customer' as const,
      legal_name: 'Distribuidora El Sol SRL',
      trade_name: 'El Sol',
      iva_condition: 'responsable_inscripto' as const,
      email: 'compras@elsol.com.ar',
      phone: '011-4234-5678',
    },
    {
      type: 'customer' as const,
      legal_name: 'Comercial Norte SA',
      trade_name: null,
      iva_condition: 'responsable_inscripto' as const,
      email: 'admin@comercialnorte.com.ar',
      phone: '0342-456-7890',
    },
    {
      type: 'supplier' as const,
      legal_name: 'Proveedora Central SRL',
      trade_name: 'ProCentral',
      iva_condition: 'responsable_inscripto' as const,
      email: 'ventas@procentral.com.ar',
      phone: '011-5678-1234',
    },
    {
      type: 'supplier' as const,
      legal_name: 'Importaciones del Sur SA',
      trade_name: 'ImpoSur',
      iva_condition: 'responsable_inscripto' as const,
      email: 'contacto@imposur.com.ar',
      phone: '0261-789-0123',
    },
  ]

  const seededContacts: Contact[] = []

  for (const c of contactsSpec) {
    const [contact] = await Contact.findOrCreate({
      where: { org_id: orgId, legal_name: c.legal_name },
      defaults: {
        org_id: orgId,
        type: c.type,
        legal_name: c.legal_name,
        trade_name: c.trade_name,
        cuit: null,
        iva_condition: c.iva_condition,
        email: c.email,
        phone: c.phone,
        notes: null,
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    seededContacts.push(contact)

    if (c.type !== 'customer') continue

    const fiscalStreet = c.trade_name ? `Av. Fiscal ${c.trade_name}` : `Av. Fiscal ${c.legal_name.split(' ')[0]}`
    const deliveryStreet = c.trade_name ? `Calle Entrega ${c.trade_name}` : `Calle Entrega ${c.legal_name.split(' ')[0]}`

    await ContactAddress.findOrCreate({
      where: {
        org_id: orgId,
        contact_id: contact.id,
        type: 'fiscal',
        street: fiscalStreet,
        city: 'CABA',
        province: 'Buenos Aires',
      },
      defaults: {
        org_id: orgId,
        contact_id: contact.id,
        type: 'fiscal',
        street: fiscalStreet,
        number: '100',
        floor: null,
        apartment: null,
        city: 'CABA',
        province: 'Buenos Aires',
        postal_code: '1000',
        country: 'Argentina',
        is_default: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })

    await ContactAddress.findOrCreate({
      where: {
        org_id: orgId,
        contact_id: contact.id,
        type: 'delivery',
        street: deliveryStreet,
        city: 'CABA',
        province: 'Buenos Aires',
      },
      defaults: {
        org_id: orgId,
        contact_id: contact.id,
        type: 'delivery',
        street: deliveryStreet,
        number: '200',
        floor: null,
        apartment: null,
        city: 'CABA',
        province: 'Buenos Aires',
        postal_code: '1000',
        country: 'Argentina',
        is_default: true,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
  }

  return seededContacts
}

async function seedCatalog(
  orgId: string,
  actorId: string,
  t: import('sequelize').Transaction,
): Promise<Map<string, ProductVariant>> {
  const categoriesSpec = [
    { name: 'Servicios', description: 'Servicios y horas', slug: 'servicios' },
    { name: 'Insumos',   description: 'Insumos y materiales', slug: 'insumos' },
  ] as const

  const categories = new Map<string, ProductCategory>()
  for (const c of categoriesSpec) {
    const [cat] = await ProductCategory.findOrCreate({
      where: { org_id: orgId, slug: c.slug },
      defaults: {
        org_id: orgId, parent_id: null, name: c.name, slug: c.slug,
        description: c.description, status: 'active',
        created_by: actorId, updated_by: actorId,
      },
      transaction: t,
    })
    categories.set(c.slug, cat)
  }

  type VariantSpec = {
    sku: string
    variantName: string | null
    price: string
    manage_stock: boolean
    stock_quantity: number
  }
  type ProductSpec = {
    name: string
    categorySlug: 'servicios' | 'insumos'
    product_type: ProductType
    unit_of_measure: UnitOfMeasure
    iva_rate: ProductIvaRate
    variants: VariantSpec[]
  }

  // Each entry: one product row + one or more variant rows
  const productsSpec: ProductSpec[] = [
    {
      name: 'Consultoría (hora)', categorySlug: 'servicios', product_type: 'service',
      unit_of_measure: 'hora', iva_rate: '21',
      variants: [{ sku: 'CONS-HORA', variantName: null, price: '1000.00', manage_stock: false, stock_quantity: 0 }],
    },
    {
      name: 'Soporte (hora)', categorySlug: 'servicios', product_type: 'service',
      unit_of_measure: 'hora', iva_rate: '21',
      variants: [{ sku: 'SOP-HORA', variantName: null, price: '800.00', manage_stock: false, stock_quantity: 0 }],
    },
    {
      // Single-variant product (default variant, no variant name)
      name: 'Caja de guantes descartables', categorySlug: 'insumos', product_type: 'simple',
      unit_of_measure: 'caja', iva_rate: '21',
      variants: [{ sku: 'GUANTES-CAJA', variantName: null, price: '2500.00', manage_stock: true, stock_quantity: 100 }],
    },
    {
      // Multi-variant product: sizes S / M / L
      name: 'Guantes de nitrilo', categorySlug: 'insumos', product_type: 'simple',
      unit_of_measure: 'par', iva_rate: '21',
      variants: [
        { sku: 'GUANTES-NIL-S', variantName: 'Talla S', price: '350.00', manage_stock: true, stock_quantity: 200 },
        { sku: 'GUANTES-NIL-M', variantName: 'Talla M', price: '350.00', manage_stock: true, stock_quantity: 180 },
        { sku: 'GUANTES-NIL-L', variantName: 'Talla L', price: '350.00', manage_stock: true, stock_quantity: 150 },
      ],
    },
    {
      // Multi-variant product: con / sin válvula
      name: 'Mascarilla FFP2', categorySlug: 'insumos', product_type: 'simple',
      unit_of_measure: 'unidad', iva_rate: '21',
      variants: [
        { sku: 'MASCARILLA-SV', variantName: 'Sin válvula', price: '850.00', manage_stock: true, stock_quantity: 300 },
        { sku: 'MASCARILLA-CV', variantName: 'Con válvula', price: '950.00', manage_stock: true, stock_quantity: 250 },
      ],
    },
  ]

  const allVariants    = new Map<string, ProductVariant>()
  const pricesBySku    = new Map<string, string>()

  for (const p of productsSpec) {
    const slug = slugifyText(p.name)
    const category_id = categories.get(p.categorySlug)?.id ?? null

    const [product] = await Product.findOrCreate({
      where: { org_id: orgId, slug },
      defaults: {
        org_id: orgId, category_id, name: p.name, slug,
        description: null, short_description: null,
        product_type: p.product_type, status: 'active', vendor: null,
        iva_rate: p.iva_rate, unit_of_measure: p.unit_of_measure,
        ncm_code: null, tags: [], images: [],
        created_by: actorId, updated_by: actorId,
      },
      transaction: t,
    })

    for (let i = 0; i < p.variants.length; i++) {
      const v = p.variants[i]!
      const isDefault = i === 0
      const [variant] = await ProductVariant.findOrCreate({
        where: { org_id: orgId, sku: v.sku },
        defaults: {
          org_id: orgId, product_id: product.id, sku: v.sku,
          barcode: null, name: v.variantName,
          is_default: isDefault,
          cost_price: null, base_price: v.price,
          manage_stock: v.manage_stock, stock_quantity: v.stock_quantity,
          created_by: actorId, updated_by: actorId,
        },
        transaction: t,
      })
      allVariants.set(v.sku, variant)
      pricesBySku.set(v.sku, v.price)
    }
  }

  const [priceList] = await PriceList.findOrCreate({
    where: { org_id: orgId, name: 'Lista General' },
    defaults: {
      org_id: orgId, name: 'Lista General', description: 'Lista base de ejemplo',
      is_default: true, is_active: true, created_by: actorId, updated_by: actorId,
    },
    transaction: t,
  })

  if (!priceList.is_default) {
    await priceList.update({ is_default: true, updated_by: actorId }, { transaction: t })
  }

  for (const [sku, variant] of allVariants) {
    const price = pricesBySku.get(sku) ?? '0.00'
    await PriceListItem.findOrCreate({
      where: { org_id: orgId, price_list_id: priceList.id, product_variant_id: variant.id },
      defaults: {
        org_id: orgId, price_list_id: priceList.id, product_variant_id: variant.id,
        price, valid_from: new Date(), created_by: actorId, updated_by: actorId,
      },
      transaction: t,
    })
  }

  return allVariants
}

// Distribution of initial stock across warehouses when there are multiple branches.
// First branch gets ~60%, rest split the remainder evenly.
function distributeStock(total: number, branches: Branch[]): number[] {
  if (branches.length === 1) return [total]
  const first = Math.ceil(total * 0.6)
  const rest   = total - first
  const perRest = Math.floor(rest / (branches.length - 1))
  return [first, ...Array(branches.length - 1).fill(perRest)]
}

async function seedInventory(
  orgId: string,
  branches: Branch[],
  actorId: string,
  t: import('sequelize').Transaction,
) {
  const trackableVariants = await ProductVariant.findAll({
    where: { org_id: orgId, manage_stock: true },
    attributes: ['id', 'sku', 'stock_quantity'],
    transaction: t,
  })

  const warehouses: import('@/modules/inventory/warehouse.model').default[] = []
  for (const branch of branches) {
    const [warehouse] = await Warehouse.findOrCreate({
      where: { org_id: orgId, branch_id: branch.id, name: `Depósito ${branch.name}` },
      defaults: {
        org_id:      orgId,
        branch_id:   branch.id,
        name:        `Depósito ${branch.name}`,
        description: null,
        is_active:   true,
        created_by:  actorId,
        updated_by:  actorId,
      },
      transaction: t,
    })
    warehouses.push(warehouse)
  }

  for (const variant of trackableVariants) {
    const totalStock = Number(variant.stock_quantity) || 50
    const distribution = distributeStock(totalStock, branches)

    for (let i = 0; i < warehouses.length; i++) {
      const warehouse = warehouses[i]!
      const qty = String(distribution[i] ?? 0)

      const [item, created] = await StockItem.findOrCreate({
        where:    { variant_id: variant.id, warehouse_id: warehouse.id },
        defaults: { variant_id: variant.id, warehouse_id: warehouse.id, org_id: orgId, quantity: qty },
        transaction: t,
      })

      if (created) {
        await StockMovement.create(
          {
            variant_id:      variant.id,
            warehouse_id:    warehouse.id,
            org_id:          orgId,
            movement_type:   'in',
            reference_type:  'initial',
            reference_id:    null,
            quantity_delta:  qty,
            quantity_before: '0',
            quantity_after:  qty,
            notes:           'Stock inicial (seed)',
            created_by:      actorId,
            updated_by:      actorId,
          },
          { transaction: t },
        )
      }

      void item
    }
  }
}

async function seedPurchases(
  orgId: string,
  branch: Branch,
  actorId: string,
  variantsBySku: Map<string, ProductVariant>,
  contacts: Contact[],
  t: import('sequelize').Transaction,
) {
  // Guard: only seed once
  const existing = await PurchaseOrder.findOne({ where: { org_id: orgId, notes: 'Orden de compra de prueba' }, transaction: t })
  if (existing) return

  const supplier = contacts.find(c => c.legal_name === 'Proveedora Central SRL') ?? null

  // ── Items ─────────────────────────────────────────────────────────────────
  const iva_rate: IvaRate = '21'

  const guantesMVariant = variantsBySku.get('GUANTES-NIL-M') ?? null
  const mascarillaSVVariant = variantsBySku.get('MASCARILLA-SV') ?? null

  const purchaseLines = [
    {
      product_id:   guantesMVariant?.product_id ?? null,
      variant_id:   guantesMVariant?.id ?? null,
      description:  'Guantes de nitrilo Talla M',
      quantity:     '50',
      unit_price:   '280.00',
      discount_pct: '0.00',
      iva_rate,
      sort_order: 0,
    },
    {
      product_id:   mascarillaSVVariant?.product_id ?? null,
      variant_id:   mascarillaSVVariant?.id ?? null,
      description:  'Mascarilla FFP2 sin válvula',
      quantity:     '100',
      unit_price:   '650.00',
      discount_pct: '0.00',
      iva_rate,
      sort_order: 1,
    },
  ]

  const linesTotals  = purchaseLines.map(l => calcPurchaseLine(l.quantity, l.unit_price, l.discount_pct, l.iva_rate))
  const docTotals    = calcPurchaseTotals(linesTotals)

  // ── 1. Purchase Order (received) ──────────────────────────────────────────
  const order_number = await nextPurchaseDocNumber(orgId, branch.id, 'purchase_order', t)
  const order = await PurchaseOrder.create(
    {
      org_id:            orgId,
      branch_id:         branch.id,
      contact_id:        supplier?.id ?? null,
      order_number,
      buyer_id:          actorId,
      status:            'received',
      expected_date:     null,
      currency:          'ARS',
      payment_condition: 'net_30',
      subtotal:          docTotals.subtotal,
      discount_amount:   docTotals.discount_amount,
      tax_amount:        docTotals.tax_amount,
      total:             docTotals.total,
      notes:             'Orden de compra de prueba',
      internal_notes:    null,
      created_by:        actorId,
      updated_by:        actorId,
    },
    { transaction: t },
  )

  const orderItems: PurchaseOrderItem[] = []
  for (let i = 0; i < purchaseLines.length; i++) {
    const l  = purchaseLines[i]!
    const lt = linesTotals[i]!
    const item = await PurchaseOrderItem.create(
      {
        org_id:          orgId,
        order_id:        order.id,
        product_id:      l.product_id,
        variant_id:      l.variant_id,
        description:     l.description,
        quantity:        l.quantity,
        received_qty:    l.quantity, // fully received
        unit_price:      l.unit_price,
        discount_pct:    l.discount_pct,
        iva_rate:        l.iva_rate,
        subtotal:        lt.subtotal,
        discount_amount: lt.discount_amount,
        tax_amount:      lt.tax_amount,
        total:           lt.total,
        sort_order:      l.sort_order,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )
    orderItems.push(item)
  }

  // ── 2. Purchase Receipt (confirmed) + stock movements ─────────────────────
  const warehouse = await Warehouse.findOne({
    where: { org_id: orgId, branch_id: branch.id },
    transaction: t,
  })

  const receipt_number = await nextPurchaseDocNumber(orgId, branch.id, 'receipt', t)
  const receipt = await PurchaseReceipt.create(
    {
      org_id:         orgId,
      branch_id:      branch.id,
      order_id:       order.id,
      contact_id:     supplier?.id ?? null,
      warehouse_id:   warehouse?.id ?? null,
      receipt_number,
      status:         'confirmed',
      receipt_date:   new Date(),
      notes:          null,
      internal_notes: null,
      created_by:     actorId,
      updated_by:     actorId,
    },
    { transaction: t },
  )

  for (let i = 0; i < purchaseLines.length; i++) {
    const l       = purchaseLines[i]!
    const orderItem = orderItems[i]!

    await PurchaseReceiptItem.create(
      {
        org_id:        orgId,
        receipt_id:    receipt.id,
        order_item_id: orderItem.id,
        product_id:    l.product_id,
        variant_id:    l.variant_id,
        description:   l.description,
        quantity:      l.quantity,
        unit_cost:     l.unit_price,
        sort_order:    i,
        created_by:    actorId,
        updated_by:    actorId,
      },
      { transaction: t },
    )

    // Stock: only tracked variants
    if (!l.variant_id || !warehouse) continue

    const delta = parseFloat(l.quantity)
    const stockItem = await StockItem.findOne({
      where: { variant_id: l.variant_id, warehouse_id: warehouse.id },
      transaction: t,
      lock: true,
    })

    const before = stockItem ? parseFloat(String(stockItem.quantity)) : 0
    const after  = before + delta

    if (stockItem) {
      await stockItem.update({ quantity: String(after) }, { transaction: t })
    } else {
      await StockItem.create(
        { variant_id: l.variant_id, warehouse_id: warehouse.id, org_id: orgId, quantity: String(after) },
        { transaction: t },
      )
    }

    await StockMovement.create(
      {
        variant_id:      l.variant_id,
        warehouse_id:    warehouse.id,
        org_id:          orgId,
        movement_type:   'in',
        reference_type:  'purchase_receipt',
        reference_id:    receipt.id,
        quantity_delta:  String(delta),
        quantity_before: String(before),
        quantity_after:  String(after),
        notes:           `Recepción ${receipt_number}`,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )
  }

  // ── 3. Supplier Invoice (partially_paid) ──────────────────────────────────
  const invoice_number = await nextPurchaseDocNumber(orgId, branch.id, 'supplier_invoice', t)
  const partialPayment = '40000.00'
  const balance        = String((parseFloat(docTotals.total) - parseFloat(partialPayment)).toFixed(2))

  const invoice = await SupplierInvoice.create(
    {
      org_id:                  orgId,
      branch_id:               branch.id,
      contact_id:              supplier?.id ?? null,
      order_id:                order.id,
      receipt_id:              receipt.id,
      invoice_number,
      supplier_invoice_number: '0001-00001234',
      status:                  'partially_paid',
      invoice_date:            new Date(),
      due_date:                new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payment_condition:       'net_30',
      currency:                'ARS',
      subtotal:                docTotals.subtotal,
      discount_amount:         docTotals.discount_amount,
      tax_amount:              docTotals.tax_amount,
      total:                   docTotals.total,
      paid_amount:             partialPayment,
      balance,
      notes:                   null,
      internal_notes:          null,
      created_by:              actorId,
      updated_by:              actorId,
    },
    { transaction: t },
  )

  for (let i = 0; i < purchaseLines.length; i++) {
    const l  = purchaseLines[i]!
    const lt = linesTotals[i]!
    await SupplierInvoiceItem.create(
      {
        org_id:          orgId,
        invoice_id:      invoice.id,
        product_id:      l.product_id,
        variant_id:      l.variant_id,
        description:     l.description,
        quantity:        l.quantity,
        unit_price:      l.unit_price,
        discount_pct:    l.discount_pct,
        iva_rate:        l.iva_rate,
        subtotal:        lt.subtotal,
        discount_amount: lt.discount_amount,
        tax_amount:      lt.tax_amount,
        total:           lt.total,
        sort_order:      i,
        created_by:      actorId,
        updated_by:      actorId,
      },
      { transaction: t },
    )
  }

  // ── 4. Supplier Payment (partial) ─────────────────────────────────────────
  const payment_number = await nextPurchaseDocNumber(orgId, branch.id, 'supplier_payment', t)
  await SupplierPayment.create(
    {
      org_id:         orgId,
      branch_id:      branch.id,
      invoice_id:     invoice.id,
      contact_id:     supplier?.id ?? null,
      payment_number,
      payment_date:   new Date(),
      amount:         partialPayment,
      payment_method: 'transfer',
      notes:          'Pago parcial de prueba',
      created_by:     actorId,
      updated_by:     actorId,
    },
    { transaction: t },
  )
}

async function run() {
  const allowProd = process.env.ALLOW_PROD_SEED === 'yes'
  if (process.env.NODE_ENV !== 'development' && !allowProd) {
    throw new Error(
      'seed-dev is only allowed in development (use pnpm db:seed-prod for production)',
    )
  }
  if (allowProd) {
    const dbUrl = process.env.DATABASE_URL?.trim()
    if (!dbUrl) {
      throw new Error(
        'DATABASE_URL is empty in .env.production.local. Copy the connection string from Vercel → Project → Settings → Environment Variables (or Neon dashboard) into that file, then re-run pnpm db:seed-prod.',
      )
    }
    const masked = dbUrl.replace(/:([^:@/]+)@/, ':***@')
    console.warn(`⚠️  Seeding production database: ${masked}`)
  }

  const seed = buildSeedConfig(allowProd)

  await sequelize.transaction(async (t) => {
    await ensurePermissionsSeeded(t)

    // sys-admin (no org)
    const sysHash = await hashPassword(seed.sysAdmin.password)
    const [sysAdmin, sysAdminCreated] = await User.findOrCreate({
      where: { email: seed.sysAdmin.email },
      defaults: {
        email: seed.sysAdmin.email,
        name: seed.sysAdmin.name,
        password_hash: sysHash,
        role: 'sys-admin',
        is_active: true,
        org_id: null,
        branch_id: null,
      },
      transaction: t,
    })
    if (allowProd && !sysAdminCreated) {
      await sysAdmin.update({ password_hash: sysHash }, { transaction: t })
    }

    for (const tenant of seed.tenants) {
      const [org] = await Organization.findOrCreate({
        where: { slug: tenant.slug },
        defaults: { name: tenant.name, slug: tenant.slug, is_active: true },
        transaction: t,
      })

      if (!org.onboarding_completed_at) {
        await org.update(
          {
            onboarding_completed_at: new Date(),
            onboarding_data: {
              company: { razonSocial: tenant.name, nombreComercial: tenant.name },
              productsMode: 'manual',
            },
          },
          { transaction: t },
        )
      }

      // Premium SA: plan base sin módulos premium (inventario, compras, contabilidad, pos)
      if (tenant.slug === 'premium') {
        await OrganizationSetting.findOrCreate({
          where: { org_id: org.id },
          defaults: {
            org_id: org.id,
            enabled_modules: [...BASE_PLAN_ENABLED_MODULES],
            enabled_features: {},
          },
          transaction: t,
        })
      }

      const branches: Branch[] = []
      let defaultCustomerId: string | null = null
      let variantsBySku = new Map<string, ProductVariant>()
      let code = 1
      for (const b of tenant.branches) {
        const [branch] = await Branch.findOrCreate({
          where: { org_id: org.id, branch_code: code },
          defaults: {
            org_id: org.id,
            branch_code: code,
            name: b.name,
            address: b.address,
            is_active: true,
          },
          transaction: t,
        })
        code += 1
        branches.push(branch)
      }

      for (const u of tenant.users) {
        const password_hash = await hashPassword(u.password)
        const defaultBranch = branches[u.branchIndex]!
        const [user, userCreated] = await User.findOrCreate({
          where: { email: u.email },
          defaults: {
            email: u.email,
            name: u.name,
            password_hash,
            role: u.role,
            is_active: true,
            org_id: org.id,
            branch_id: defaultBranch.id,
          },
          transaction: t,
        })
        if (allowProd && !userCreated) {
          await user.update({ password_hash }, { transaction: t })
        }

        const allowed = u.allowedBranchIndexes.map((idx) => branches[idx]!.id)
        for (const branch_id of allowed) {
          await UserBranch.findOrCreate({
            where: { user_id: user.id, branch_id },
            defaults: { user_id: user.id, branch_id },
            transaction: t,
          })
        }

        // Seed catalog, contacts, and inventory once per org (using the admin user as actor)
        if (u.role === 'admin') {
          variantsBySku = await seedCatalog(org.id, user.id, t)
          const contacts = await seedContacts(org.id, user.id, t)
          const defaultCustomer = contacts.find(c => c.type === 'customer' || c.type === 'both') ?? null
          defaultCustomerId = defaultCustomer?.id ?? null
          await seedInventory(org.id, branches, user.id, t)

          // Purchases seed (demo tenant only)
          if (tenant.slug === 'demo') {
            const defaultBranch = branches[0]!
            await seedPurchases(org.id, defaultBranch, user.id, variantsBySku, contacts, t)
          }
        }

        // Seed a minimal sales flow for the first user of the first tenant only
        if (tenant.slug === 'demo' && u.email === 'admin@demo.local') {
          // Only create the sample docs if they don't exist yet.
          const existing = await SalesQuote.findOne({ where: { org_id: org.id, notes: 'Presupuesto de prueba' }, transaction: t })
          if (existing) continue

          const iva_rate: IvaRate = '21'

          // Line 1 — service (no stock impact)
          const lineService = {
            product_id: null as string | null,
            variant_id: null as string | null,
            description: 'Servicio de consultoría',
            quantity: '1',
            unit_price: '1000.00',
            discount_pct: '0.00',
            iva_rate,
            sort_order: 0,
          }

          // Line 2 — trackable product variant (Guantes de nitrilo Talla M)
          const guantesMVariant = variantsBySku.get('GUANTES-NIL-M') ?? null
          const lineGuantes = {
            product_id: guantesMVariant?.product_id ?? null,
            variant_id: guantesMVariant?.id ?? null,
            description: 'Guantes de nitrilo Talla M',
            quantity: '5',
            unit_price: '350.00',
            discount_pct: '0.00',
            iva_rate,
            sort_order: 1,
          }

          // Line 3 — another trackable variant (Mascarilla FFP2 Sin válvula)
          const mascarillaSVVariant = variantsBySku.get('MASCARILLA-SV') ?? null
          const lineMascarilla = {
            product_id: mascarillaSVVariant?.product_id ?? null,
            variant_id: mascarillaSVVariant?.id ?? null,
            description: 'Mascarilla FFP2 sin válvula',
            quantity: '10',
            unit_price: '850.00',
            discount_pct: '0.00',
            iva_rate,
            sort_order: 2,
          }

          const lines = [lineService, lineGuantes, lineMascarilla]
          const linesTotals = lines.map(l => calcLineItem(l.quantity, l.unit_price, l.discount_pct, l.iva_rate))
          const docTotals = calcDocumentTotals(linesTotals)

          const quote_number = await nextDocumentNumber(org.id, defaultBranch.id, 'quote', t)
          const quote = await SalesQuote.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: defaultCustomerId,
              quote_number,
              salesperson_id: user.id,
              status: 'accepted',
              valid_until: null,
              payment_condition: 'cash',
              currency: 'ARS',
              subtotal: docTotals.subtotal,
              discount_amount: docTotals.discount_amount,
              tax_amount: docTotals.tax_amount,
              total: docTotals.total,
              notes: 'Presupuesto de prueba',
              internal_notes: null,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          for (let i = 0; i < lines.length; i++) {
            const l = lines[i]!
            const lt = linesTotals[i]!
            await SalesQuoteItem.create(
              {
                org_id: org.id, quote_id: quote.id,
                product_id: l.product_id, variant_id: l.variant_id,
                description: l.description, quantity: l.quantity,
                unit_price: l.unit_price, discount_pct: l.discount_pct, iva_rate: l.iva_rate,
                subtotal: lt.subtotal, discount_amount: lt.discount_amount,
                tax_base: lt.tax_base, tax_amount: lt.tax_amount, total: lt.total,
                sort_order: l.sort_order, created_by: user.id, updated_by: user.id,
              },
              { transaction: t },
            )
          }

          const order_number = await nextDocumentNumber(org.id, defaultBranch.id, 'order', t)
          const order = await SalesOrder.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: defaultCustomerId,
              quote_id: quote.id,
              order_number,
              salesperson_id: user.id,
              status: 'confirmed',
              payment_condition: 'cash',
              currency: 'ARS',
              promised_date: null,
              delivered_date: null,
              subtotal: docTotals.subtotal,
              discount_amount: docTotals.discount_amount,
              tax_amount: docTotals.tax_amount,
              total: docTotals.total,
              notes: 'Pedido de prueba',
              internal_notes: null,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          for (let i = 0; i < lines.length; i++) {
            const l = lines[i]!
            const lt = linesTotals[i]!
            await SalesOrderItem.create(
              {
                org_id: org.id, order_id: order.id,
                product_id: l.product_id, variant_id: l.variant_id,
                description: l.description, quantity: l.quantity,
                unit_price: l.unit_price, discount_pct: l.discount_pct, iva_rate: l.iva_rate,
                subtotal: lt.subtotal, discount_amount: lt.discount_amount,
                tax_base: lt.tax_base, tax_amount: lt.tax_amount, total: lt.total,
                sort_order: l.sort_order, created_by: user.id, updated_by: user.id,
              },
              { transaction: t },
            )
          }

          const invoice_number = await nextDocumentNumber(org.id, defaultBranch.id, 'invoice', t)
          const invoice = await Invoice.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: defaultCustomerId,
              order_id: order.id,
              quote_id: quote.id,
              invoice_number,
              salesperson_id: user.id,
              status: 'issued',
              issue_date: new Date(),
              due_date: null,
              payment_condition: 'cash',
              currency: 'ARS',
              subtotal: docTotals.subtotal,
              discount_amount: docTotals.discount_amount,
              tax_amount: docTotals.tax_amount,
              total: docTotals.total,
              paid_amount: '0.00',
              balance: docTotals.total,
              notes: 'Factura de prueba',
              internal_notes: null,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          for (let i = 0; i < lines.length; i++) {
            const l = lines[i]!
            const lt = linesTotals[i]!
            await InvoiceItem.create(
              {
                org_id: org.id, invoice_id: invoice.id,
                product_id: l.product_id, variant_id: l.variant_id,
                description: l.description, quantity: l.quantity,
                unit_price: l.unit_price, discount_pct: l.discount_pct, iva_rate: l.iva_rate,
                subtotal: lt.subtotal, discount_amount: lt.discount_amount,
                tax_base: lt.tax_base, tax_amount: lt.tax_amount, total: lt.total,
                sort_order: l.sort_order, created_by: user.id, updated_by: user.id,
              },
              { transaction: t },
            )
          }

          const payment_number = await nextDocumentNumber(org.id, defaultBranch.id, 'payment', t)
          const paidAmount = docTotals.total
          await Payment.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              invoice_id: invoice.id,
              contact_id: defaultCustomerId,
              payment_number,
              payment_date: new Date(),
              amount: paidAmount,
              payment_method: 'transfer',
              reference: 'TRX-DEV-1',
              notes: 'Cobro de prueba',
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          await invoice.update(
            { paid_amount: paidAmount, balance: '0.00', status: 'paid', updated_by: user.id },
            { transaction: t },
          )
        }
      }
    }
  })

  if (allowProd) {
    console.log('Prod seed completed.')
    console.log('Users created/updated. Passwords loaded from SEED_* env vars (not printed).')
    console.log(`  sys-admin: ${seed.sysAdmin.email}`)
    console.log('  demo: admin@demo.local, op@demo.local')
    console.log('  premium: admin@premium.local')
  } else {
    console.log('Dev seed completed.')
    console.log(`Sys-admin: ${seed.sysAdmin.email} / ${seed.sysAdmin.password}`)
    console.log('Tenant demo: admin@demo.local / demo12345, op@demo.local / demo12345')
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())

