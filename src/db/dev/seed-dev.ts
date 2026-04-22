import sequelize from '@/lib/db'
import Organization from '@/modules/auth/organization.model'
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
import Product from '@/modules/catalog/product.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import PriceList from '@/modules/catalog/price-list.model'
import PriceListItem from '@/modules/catalog/price-list-item.model'
import { slugifyText } from '@/lib/slug'

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

async function hashPassword(plaintext: string) {
  return bcrypt.hash(plaintext, 12)
}

async function ensurePermissionsSeeded(t: import('sequelize').Transaction) {
  const resources = ['contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting'] as const
  const actions = ['read', 'write', 'delete'] as const

  const permissions = resources.flatMap((r) =>
    actions.map((a) => ({
      name: `${r}:${a}`,
      description: `${a.charAt(0).toUpperCase() + a.slice(1)} ${r}`,
    })),
  )

  // 1) Ensure permissions catalog exists
  for (const p of permissions) {
    await sequelize.query(
      `insert into permissions (name, description)
       values (:name, :description)
       on conflict (name) do nothing`,
      { transaction: t, replacements: p },
    )
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
        `insert into role_permissions (role, permission_id, org_id)
         select :role, p.id, null
         from permissions p
         where p.name = :name
         on conflict on constraint uq_role_permission_org do nothing`,
        { transaction: t, replacements: { role, name: permName } },
      )
    }
  }
}

async function seedCatalog(orgId: string, actorId: string, t: import('sequelize').Transaction) {
  const categoriesSpec = [
    { name: 'Servicios', description: 'Servicios y horas', slug: 'servicios' },
    { name: 'Insumos', description: 'Insumos y materiales', slug: 'insumos' },
  ] as const

  const categories = new Map<string, ProductCategory>()
  for (const c of categoriesSpec) {
    const [cat] = await ProductCategory.findOrCreate({
      where: { org_id: orgId, slug: c.slug },
      defaults: {
        org_id: orgId,
        parent_id: null,
        name: c.name,
        slug: c.slug,
        description: c.description,
        status: 'active',
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
    categories.set(c.slug, cat)
  }

  const productsSpec = [
    { name: 'Consultoría (hora)', categorySlug: 'servicios', product_type: 'service', unit_of_measure: 'hora', iva_rate: '21', sku: 'CONS-HORA', price: '1000.00' },
    { name: 'Soporte (hora)', categorySlug: 'servicios', product_type: 'service', unit_of_measure: 'hora', iva_rate: '21', sku: 'SOP-HORA', price: '800.00' },
    { name: 'Caja de guantes', categorySlug: 'insumos', product_type: 'simple', unit_of_measure: 'caja', iva_rate: '21', sku: 'GUANTES-CAJA', price: '2500.00' },
  ] as const

  const variants: ProductVariant[] = []
  for (const p of productsSpec) {
    const slug = slugifyText(p.name)
    const category_id = categories.get(p.categorySlug)?.id ?? null

    const [product] = await Product.findOrCreate({
      where: { org_id: orgId, slug },
      defaults: {
        org_id: orgId,
        category_id,
        name: p.name,
        slug,
        description: null,
        short_description: null,
        product_type: p.product_type,
        status: 'active',
        vendor: null,
        iva_rate: p.iva_rate,
        unit_of_measure: p.unit_of_measure,
        ncm_code: null,
        tags: [],
        images: [],
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })

    const [variant] = await ProductVariant.findOrCreate({
      where: { org_id: orgId, sku: p.sku },
      defaults: {
        org_id: orgId,
        product_id: product.id,
        sku: p.sku,
        barcode: null,
        name: null,
        is_default: true,
        cost_price: null,
        base_price: p.price,
        manage_stock: p.product_type === 'simple',
        stock_quantity: p.product_type === 'simple' ? 50 : 0,
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })

    variants.push(variant)
  }

  const [priceList] = await PriceList.findOrCreate({
    where: { org_id: orgId, name: 'Lista General' },
    defaults: {
      org_id: orgId,
      name: 'Lista General',
      description: 'Lista base de ejemplo',
      is_default: true,
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
    },
    transaction: t,
  })

  // Ensure default flag (idempotent)
  if (!priceList.is_default) {
    await priceList.update({ is_default: true, updated_by: actorId }, { transaction: t })
  }

  const priceBySku = new Map<string, string>(productsSpec.map(p => [p.sku, p.price]))
  for (const v of variants) {
    const price = priceBySku.get(v.sku) ?? '0.00'
    await PriceListItem.findOrCreate({
      where: { org_id: orgId, price_list_id: priceList.id, product_variant_id: v.id },
      defaults: {
        org_id: orgId,
        price_list_id: priceList.id,
        product_variant_id: v.id,
        price,
        valid_from: new Date(),
        created_by: actorId,
        updated_by: actorId,
      },
      transaction: t,
    })
  }
}

async function run() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('seed-dev is only allowed in development')
  }

  await sequelize.transaction(async (t) => {
    await ensurePermissionsSeeded(t)

    // sys-admin (no org)
    const sysHash = await hashPassword(DEV_SEED.sysAdmin.password)
    await User.findOrCreate({
      where: { email: DEV_SEED.sysAdmin.email },
      defaults: {
        email: DEV_SEED.sysAdmin.email,
        name: DEV_SEED.sysAdmin.name,
        password_hash: sysHash,
        role: 'sys-admin',
        is_active: true,
        org_id: null,
        branch_id: null,
      },
      transaction: t,
    })

    for (const tenant of DEV_SEED.tenants) {
      const [org] = await Organization.findOrCreate({
        where: { slug: tenant.slug },
        defaults: { name: tenant.name, slug: tenant.slug, is_active: true },
        transaction: t,
      })

      const branches: Branch[] = []
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
        const [user] = await User.findOrCreate({
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

        const allowed = u.allowedBranchIndexes.map((idx) => branches[idx]!.id)
        for (const branch_id of allowed) {
          await UserBranch.findOrCreate({
            where: { user_id: user.id, branch_id },
            defaults: { user_id: user.id, branch_id },
            transaction: t,
          })
        }

        // Seed catalog once per org (using the admin user as actor)
        if (u.role === 'admin') {
          await seedCatalog(org.id, user.id, t)
        }

        // Seed a minimal sales flow for the first user of the first tenant only
        if (tenant.slug === 'demo' && u.email === 'admin@demo.local') {
          // Only create the sample docs if they don't exist yet.
          const existing = await SalesQuote.findOne({ where: { org_id: org.id, notes: 'Presupuesto de prueba' }, transaction: t })
          if (existing) continue

          const iva_rate: IvaRate = '21'
          const line = {
            product_id: null,
            description: 'Servicio de consultoría',
            quantity: '1',
            unit_price: '1000.00',
            discount_pct: '0.00',
            iva_rate,
            sort_order: 0,
          } as const

          const lineTotals = calcLineItem(line.quantity, line.unit_price, line.discount_pct, line.iva_rate)
          const docTotals = calcDocumentTotals([lineTotals])

          const quote_number = await nextDocumentNumber(org.id, defaultBranch.id, 'quote', t)
          const quote = await SalesQuote.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: null,
              quote_number,
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

          await SalesQuoteItem.create(
            {
              org_id: org.id,
              quote_id: quote.id,
              product_id: line.product_id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_pct: line.discount_pct,
              iva_rate: line.iva_rate,
              subtotal: lineTotals.subtotal,
              discount_amount: lineTotals.discount_amount,
              tax_base: lineTotals.tax_base,
              tax_amount: lineTotals.tax_amount,
              total: lineTotals.total,
              sort_order: line.sort_order,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          const order_number = await nextDocumentNumber(org.id, defaultBranch.id, 'order', t)
          const order = await SalesOrder.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: null,
              quote_id: quote.id,
              order_number,
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

          await SalesOrderItem.create(
            {
              org_id: org.id,
              order_id: order.id,
              product_id: line.product_id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_pct: line.discount_pct,
              iva_rate: line.iva_rate,
              subtotal: lineTotals.subtotal,
              discount_amount: lineTotals.discount_amount,
              tax_base: lineTotals.tax_base,
              tax_amount: lineTotals.tax_amount,
              total: lineTotals.total,
              sort_order: line.sort_order,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          const invoice_number = await nextDocumentNumber(org.id, defaultBranch.id, 'invoice', t)
          const invoice = await Invoice.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              contact_id: null,
              order_id: order.id,
              quote_id: quote.id,
              invoice_number,
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

          await InvoiceItem.create(
            {
              org_id: org.id,
              invoice_id: invoice.id,
              product_id: line.product_id,
              description: line.description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              discount_pct: line.discount_pct,
              iva_rate: line.iva_rate,
              subtotal: lineTotals.subtotal,
              discount_amount: lineTotals.discount_amount,
              tax_base: lineTotals.tax_base,
              tax_amount: lineTotals.tax_amount,
              total: lineTotals.total,
              sort_order: line.sort_order,
              created_by: user.id,
              updated_by: user.id,
            },
            { transaction: t },
          )

          const payment_number = await nextDocumentNumber(org.id, defaultBranch.id, 'payment', t)
          const paidAmount = docTotals.total
          await Payment.create(
            {
              org_id: org.id,
              branch_id: defaultBranch.id,
              invoice_id: invoice.id,
              contact_id: null,
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

  console.log('Dev seed completed.')
  console.log(`Sys-admin: ${DEV_SEED.sysAdmin.email} / ${DEV_SEED.sysAdmin.password}`)
  console.log('Tenant demo: admin@demo.local / demo12345, op@demo.local / demo12345')
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())

