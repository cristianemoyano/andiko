import sequelize from '@/lib/db'
import { Op, QueryTypes } from 'sequelize'
import Decimal from 'decimal.js'
import Contact from '@/modules/contacts/contact.model'
import ContactAddress from '@/modules/contacts/contact-address.model'
import Organization from '@/modules/auth/organization.model'
import OrganizationSetting from '@/modules/auth/organization-setting.model'
import { BASE_PLAN_ENABLED_MODULES, DEFAULT_ENABLED_MODULES } from '@/modules/auth/organization-modules'
import Branch from '@/modules/auth/branch.model'
import User from '@/modules/auth/user.model'
import UserBranch from '@/modules/auth/user-branch.model'
import OrgRole from '@/modules/auth/org-role.model'
import { seedDefaultOrgRoles, ensureOrgRoleTemplates } from '@/modules/auth/org-roles-seed'
import { DEFAULT_ORG_ROLE_TEMPLATES } from '@/modules/auth/role-labels'
import { splitLegacyUserName } from '@/modules/auth/user.utils'
import type { UserRole } from '@/types/roles'
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
import type { TenantContext } from '@/lib/tenancy'
import { seedDefaultChartOfAccounts } from '@/modules/accounting/chart-seed'
import { DEFAULT_BALANZA_CONFIG } from '@/modules/pos/balanza-barcode'
import Account from '@/modules/accounting/account.model'
import JournalEntry from '@/modules/accounting/journal-entry.model'
import JournalEntryLine from '@/modules/accounting/journal-entry-line.model'
import { nextEntryNumber } from '@/modules/accounting/accounting.utils'
import { postInvoiceIssuedAccounting } from '@/modules/accounting/sales-invoice-accounting.service'
import { postSalesPaymentAccounting } from '@/modules/accounting/sales-payment-accounting.service'
import { postSupplierInvoiceAccounting } from '@/modules/accounting/purchase-invoice-accounting.service'
import { postSupplierPaymentAccounting } from '@/modules/accounting/purchase-payment-accounting.service'
import Warehouse from '@/modules/inventory/warehouse.model'
import StockItem from '@/modules/inventory/stock-item.model'
import StockMovement from '@/modules/inventory/stock-movement.model'
import { applyMovement } from '@/modules/inventory/stock-movements.service'
import CarrierAccount from '@/modules/logistics/carrier-account.model'
import Vehicle from '@/modules/logistics/vehicle.model'
import Shipment from '@/modules/logistics/shipment.model'
import DeliveryRun from '@/modules/logistics/delivery-run.model'
import { createShipmentForOrder } from '@/modules/logistics/shipments.service'
import { createDeliveryRun } from '@/modules/logistics/delivery-runs.service'
import { createDeliveryNoteForShipment } from '@/modules/inventory/delivery-notes.service'
import PurchaseOrder from '@/modules/purchases/purchase-order.model'
import PurchaseOrderItem from '@/modules/purchases/purchase-order-item.model'
import PurchaseReceipt from '@/modules/purchases/purchase-receipt.model'
import PurchaseReceiptItem from '@/modules/purchases/purchase-receipt-item.model'
import SupplierInvoice from '@/modules/purchases/supplier-invoice.model'
import SupplierInvoiceItem from '@/modules/purchases/supplier-invoice-item.model'
import SupplierPayment from '@/modules/purchases/supplier-payment.model'
import { nextPurchaseDocNumber, calcLineItem as calcPurchaseLine, calcDocumentTotals as calcPurchaseTotals } from '@/modules/purchases/purchases.utils'
import {
  seedBillingPlans,
  seedBillingMetrics,
  seedMetricsSummaryLine,
  seedOrgSubscription,
  seedPlatformBillerSettings,
  seedPlanSummaryLines,
  seedBillerSummaryLine,
  SEED_PLAN_BY_ORG_SLUG,
} from '@/db/dev/seed-billing-plans'
import { INTEGRATION_TENANT, INTEGRATION_TEST_USERS } from './integration-seed-data'
import {
  seedIntegrationCatalog,
  seedIntegrationContacts,
  seedIntegrationFinancials,
  seedIntegrationAccounting,
  seedIntegrationPurchases,
} from './integration-seed'

const MIN_PROD_PASSWORD_LENGTH = 16

type SeedUser = {
  email: string
  password: string
  name: string
  branchIndex: number
  allowedBranchIndexes: number[]
  devOnly?: boolean
} & (
  | { role: 'admin' | 'branch-admin'; orgRoleName?: never }
  | { orgRoleName: string; role?: never }
)

type SeedConfig = {
  sysAdmin: { email: string; password: string; name: string }
  tenants: Array<{
    name: string
    slug: string
    branches: Array<{ name: string; address: string }>
    users: SeedUser[]
  }>
}

const DEV_SEED: SeedConfig = {
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
        {
          email: 'admin@demo.local',
          password: 'demo12345',
          name: 'Gerente Demo',
          role: 'admin',
          branchIndex: 0,
          allowedBranchIndexes: [0, 1],
        },
        {
          email: 'op@demo.local',
          password: 'demo12345',
          name: 'Vendedor Demo',
          orgRoleName: 'Vendedor',
          branchIndex: 1,
          allowedBranchIndexes: [1],
        },
        {
          email: 'cajero@demo.local',
          password: 'demo12345',
          name: 'Cajero Demo',
          orgRoleName: 'Cajero',
          branchIndex: 1,
          allowedBranchIndexes: [1],
          devOnly: true,
        },
        {
          email: 'sucursal@demo.local',
          password: 'demo12345',
          name: 'Encargado Sucursal Demo',
          role: 'branch-admin',
          branchIndex: 1,
          allowedBranchIndexes: [1],
          devOnly: true,
        },
        {
          email: 'compras@demo.local',
          password: 'demo12345',
          name: 'Gerente Compras Demo',
          orgRoleName: 'Gerente de compras',
          branchIndex: 0,
          allowedBranchIndexes: [0, 1],
          devOnly: true,
        },
        {
          email: 'contador@demo.local',
          password: 'demo12345',
          name: 'Contador Demo',
          orgRoleName: 'Contador',
          branchIndex: 0,
          allowedBranchIndexes: [0, 1],
          devOnly: true,
        },
        {
          email: 'deposito@demo.local',
          password: 'demo12345',
          name: 'Depósito Demo',
          orgRoleName: 'Depósito',
          branchIndex: 0,
          allowedBranchIndexes: [0],
          devOnly: true,
        },
      ],
    },
    {
      name: 'Premium SA',
      slug: 'premium',
      branches: [{ name: 'Central', address: 'Mitre 100' }],
      users: [
        { email: 'admin@premium.local', password: 'premium12345', name: 'Gerente Premium', role: 'admin', branchIndex: 0, allowedBranchIndexes: [0] },
      ],
    },
  ],
}

function resolveSeedUserRole(
  user: SeedUser,
  orgRolesByName: Map<string, string>,
): { role: UserRole; org_role_id: string | null } {
  if ('orgRoleName' in user && user.orgRoleName) {
    const org_role_id = orgRolesByName.get(user.orgRoleName)
    if (!org_role_id) {
      throw new Error(`Org role "${user.orgRoleName}" not found — run seedDefaultOrgRoles first`)
    }
    return { role: 'operator', org_role_id }
  }
  if (!('role' in user) || !user.role) {
    throw new Error(`Seed user ${user.email} must have role or orgRoleName`)
  }
  return { role: user.role, org_role_id: null }
}

function isSeedGerente(user: SeedUser): boolean {
  return 'role' in user && user.role === 'admin'
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

function buildIntegrationTenant(): SeedConfig['tenants'][number] {
  return {
    name: INTEGRATION_TENANT.name,
    slug: INTEGRATION_TENANT.slug,
    branches: [{ name: INTEGRATION_TENANT.branch.name, address: INTEGRATION_TENANT.branch.address }],
    users: [
      {
        email: INTEGRATION_TEST_USERS.admin.email,
        password: INTEGRATION_TEST_USERS.admin.password,
        name: INTEGRATION_TEST_USERS.admin.name,
        role: INTEGRATION_TEST_USERS.admin.role,
        branchIndex: 0,
        allowedBranchIndexes: [0],
      },
      {
        email: INTEGRATION_TEST_USERS.gerente.email,
        password: INTEGRATION_TEST_USERS.gerente.password,
        name: INTEGRATION_TEST_USERS.gerente.name,
        role: INTEGRATION_TEST_USERS.gerente.role,
        branchIndex: 0,
        allowedBranchIndexes: [0],
      },
      {
        email: INTEGRATION_TEST_USERS.vendedor.email,
        password: INTEGRATION_TEST_USERS.vendedor.password,
        name: INTEGRATION_TEST_USERS.vendedor.name,
        orgRoleName: 'Vendedor',
        branchIndex: 0,
        allowedBranchIndexes: [0],
      },
      {
        email: INTEGRATION_TEST_USERS.comprador.email,
        password: INTEGRATION_TEST_USERS.comprador.password,
        name: INTEGRATION_TEST_USERS.comprador.name,
        orgRoleName: 'Gerente de compras',
        branchIndex: 0,
        allowedBranchIndexes: [0],
      },
      {
        email: INTEGRATION_TEST_USERS.contador.email,
        password: INTEGRATION_TEST_USERS.contador.password,
        name: INTEGRATION_TEST_USERS.contador.name,
        orgRoleName: 'Contador',
        branchIndex: 0,
        allowedBranchIndexes: [0],
      },
    ],
  }
}

function buildSeedConfig(allowProd: boolean): SeedConfig {
  if (!allowProd) {
    return {
      ...(DEV_SEED as unknown as SeedConfig),
      tenants: [...(DEV_SEED.tenants as unknown as SeedConfig['tenants']), buildIntegrationTenant()],
    }
  }

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
        users: demo.users
          .filter(u => !u.devOnly)
          .map(u => ({
            ...u,
            password: requireProdPassword(
              'orgRoleName' in u && u.orgRoleName === 'Vendedor'
                ? 'SEED_DEMO_OPERATOR_PASSWORD'
                : 'SEED_DEMO_ADMIN_PASSWORD',
            ),
            allowedBranchIndexes: [...u.allowedBranchIndexes],
          })),
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
  const resources = ['contacts', 'products', 'sales', 'inventory', 'purchases', 'accounting', 'logistics', 'automations'] as const
  const actions = ['read', 'write', 'delete'] as const

  const modulePermissions = resources.flatMap((r) =>
    actions.map((a) => ({
      name: `${r}:${a}`,
      resource: r,
      action: a,
      description: `${a.charAt(0).toUpperCase() + a.slice(1)} ${r}`,
    })),
  )

  const extraPermissions = [
    { name: 'panel:read', resource: 'panel', action: 'read', description: 'Ver panel ejecutivo' },
    { name: 'settings:read', resource: 'settings', action: 'read', description: 'Leer configuración de la organización' },
    { name: 'settings:write', resource: 'settings', action: 'write', description: 'Editar configuración de la organización' },
  ] as const

  const permissions = [...modulePermissions, ...extraPermissions]

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
  const allPermissionNames = permissions.map((p) => p.name)

  const defaultsFor = (role: 'admin' | 'branch-admin' | 'operator' | 'readonly') => {
    if (role === 'admin') return allPermissionNames
    if (role === 'branch-admin') {
      return allPermissionNames.filter(
        (name) => !name.startsWith('settings:') && name !== 'accounting:write' && name !== 'accounting:delete',
      )
    }
    if (role === 'readonly') return allPermissionNames.filter((name) => name.endsWith(':read'))
    return allPermissionNames.filter(
      (name) =>
        name.endsWith(':read') || (name.endsWith(':write') && name !== 'accounting:write'),
    )
  }

  for (const role of ['admin', 'branch-admin', 'operator', 'readonly'] as const) {
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

function logSeedProgress(message: string) {
  if (process.env.SEED_PROGRESS !== 'no') {
    console.log(`[seed] ${message}`)
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
    { name: 'Fiambrería', description: 'Productos vendidos por peso en POS', slug: 'fiambreria' },
    { name: 'Alimentos', description: 'Almacén y comestibles', slug: 'alimentos' },
    { name: 'Bebidas', description: 'Bebidas y refrescos', slug: 'bebidas' },
    { name: 'Limpieza', description: 'Artículos de limpieza e higiene', slug: 'limpieza' },
  ] as const

  const categories = new Map<string, ProductCategory>()
  for (const c of categoriesSpec) {
    let cat = await ProductCategory.findOne({
      where: { org_id: orgId, slug: c.slug },
      paranoid: false,
      transaction: t,
    })
    if (cat) {
      if (cat.deleted_at) await cat.restore({ transaction: t })
      await cat.update(
        {
          parent_id: null,
          name: c.name,
          description: c.description,
          status: 'active',
          updated_by: actorId,
          deleted_by: null,
        },
        { transaction: t },
      )
    } else {
      cat = await ProductCategory.create(
        {
          org_id: orgId, parent_id: null, name: c.name, slug: c.slug,
          description: c.description, status: 'active',
          created_by: actorId, updated_by: actorId,
        },
        { transaction: t },
      )
    }
    categories.set(c.slug, cat)
  }

  type VariantSpec = {
    sku: string
    variantName: string | null
    price: string
    manage_stock: boolean
    stock_quantity: number
    barcode?: string
    sold_by_weight?: boolean
    plu_code?: string
  }
  type ProductSpec = {
    name: string
    categorySlug: 'servicios' | 'insumos' | 'fiambreria' | 'alimentos' | 'bebidas' | 'limpieza'
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
    {
      // Weight products for POS balanza testing (PLU matches example barcodes in balanza-barcode.test.ts)
      name: 'Jamón cocido', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'JAMON-COCIDO', variantName: null, price: '8500.00',
        manage_stock: true, stock_quantity: 50,
        sold_by_weight: true, plu_code: '00037',
      }],
    },
    {
      name: 'Queso cremoso', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'QUESO-CREMOSO', variantName: null, price: '12000.00',
        manage_stock: true, stock_quantity: 40,
        sold_by_weight: true, plu_code: '00042',
      }],
    },
    // ── Fiambrería adicional (por peso, con PLU) ────────────────────────────
    {
      name: 'Mortadela argentina', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'MORTADELA-ARG', variantName: null, price: '6500.00',
        manage_stock: true, stock_quantity: 35,
        sold_by_weight: true, plu_code: '00043',
      }],
    },
    {
      name: 'Salame tipo milán', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'SALAME-MILAN', variantName: null, price: '14500.00',
        manage_stock: true, stock_quantity: 28,
        sold_by_weight: true, plu_code: '00044',
      }],
    },
    {
      name: 'Panceta ahumada', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'PANCETA-AHUM', variantName: null, price: '9800.00',
        manage_stock: true, stock_quantity: 22,
        sold_by_weight: true, plu_code: '00045',
      }],
    },
    {
      name: 'Bondiola cocida', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'BONDIOLA-COC', variantName: null, price: '11200.00',
        manage_stock: true, stock_quantity: 18,
        sold_by_weight: true, plu_code: '00046',
      }],
    },
    {
      name: 'Queso tybo', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'QUESO-TYBO', variantName: null, price: '10500.00',
        manage_stock: true, stock_quantity: 30,
        sold_by_weight: true, plu_code: '00047',
      }],
    },
    {
      name: 'Queso sardo', categorySlug: 'fiambreria', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '21',
      variants: [{
        sku: 'QUESO-SARDO', variantName: null, price: '13800.00',
        manage_stock: true, stock_quantity: 25,
        sold_by_weight: true, plu_code: '00048',
      }],
    },
    // ── Alimentos (unidad / paquete, con EAN-13) ────────────────────────────
    {
      name: 'Arroz largo fino', categorySlug: 'alimentos', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '10.5',
      variants: [{
        sku: 'ARROZ-1KG', variantName: 'Bolsa 1 kg', price: '890.00',
        manage_stock: true, stock_quantity: 200, barcode: '7790001000002',
      }],
    },
    {
      name: 'Fideos spaghetti', categorySlug: 'alimentos', product_type: 'simple',
      unit_of_measure: 'paquete', iva_rate: '10.5',
      variants: [{
        sku: 'FIDEOS-SPAG-500', variantName: 'Paquete 500 g', price: '650.00',
        manage_stock: true, stock_quantity: 350, barcode: '7790002000001',
      }],
    },
    {
      name: 'Yerba mate', categorySlug: 'alimentos', product_type: 'simple',
      unit_of_measure: 'paquete', iva_rate: '10.5',
      variants: [
        { sku: 'YERBA-500G', variantName: 'Paquete 500 g', price: '1200.00', manage_stock: true, stock_quantity: 180, barcode: '7790009000004' },
        { sku: 'YERBA-1KG', variantName: 'Paquete 1 kg', price: '2200.00', manage_stock: true, stock_quantity: 120, barcode: '7790010000000' },
      ],
    },
    {
      name: 'Aceite de girasol', categorySlug: 'alimentos', product_type: 'simple',
      unit_of_measure: 'litro', iva_rate: '10.5',
      variants: [{
        sku: 'ACEITE-GIR-900', variantName: 'Botella 900 ml', price: '1450.00',
        manage_stock: true, stock_quantity: 160, barcode: '7790003000000',
      }],
    },
    {
      name: 'Harina 000', categorySlug: 'alimentos', product_type: 'simple',
      unit_of_measure: 'kg', iva_rate: '10.5',
      variants: [{
        sku: 'HARINA-000-1KG', variantName: 'Bolsa 1 kg', price: '720.00',
        manage_stock: true, stock_quantity: 240, barcode: '7790011000009',
      }],
    },
    // ── Bebidas ─────────────────────────────────────────────────────────────
    {
      name: 'Agua mineral sin gas', categorySlug: 'bebidas', product_type: 'simple',
      unit_of_measure: 'litro', iva_rate: '21',
      variants: [{
        sku: 'AGUA-MIN-2L', variantName: 'Botella 2 L', price: '850.00',
        manage_stock: true, stock_quantity: 300, barcode: '7790004000009',
      }],
    },
    {
      name: 'Gaseosa cola', categorySlug: 'bebidas', product_type: 'simple',
      unit_of_measure: 'litro', iva_rate: '21',
      variants: [{
        sku: 'GASEOSA-COLA-225', variantName: 'Botella 2,25 L', price: '1650.00',
        manage_stock: true, stock_quantity: 220, barcode: '7790005000008',
      }],
    },
    // ── Limpieza e insumos con código de barras ─────────────────────────────
    {
      name: 'Alcohol en gel', categorySlug: 'limpieza', product_type: 'simple',
      unit_of_measure: 'ml', iva_rate: '21',
      variants: [{
        sku: 'ALCOHOL-GEL-500', variantName: 'Frasco 500 ml', price: '980.00',
        manage_stock: true, stock_quantity: 140, barcode: '7790006000007',
      }],
    },
    {
      name: 'Detergente líquido', categorySlug: 'limpieza', product_type: 'simple',
      unit_of_measure: 'litro', iva_rate: '21',
      variants: [{
        sku: 'DETERG-LIQ-3L', variantName: 'Bidón 3 L', price: '3200.00',
        manage_stock: true, stock_quantity: 90, barcode: '7790007000006',
      }],
    },
    {
      name: 'Papel higiénico', categorySlug: 'limpieza', product_type: 'simple',
      unit_of_measure: 'paquete', iva_rate: '21',
      variants: [{
        sku: 'PAPEL-HIG-4', variantName: 'Pack 4 rollos', price: '2100.00',
        manage_stock: true, stock_quantity: 110, barcode: '7790008000005',
      }],
    },
  ]

  const allVariants    = new Map<string, ProductVariant>()
  const pricesBySku    = new Map<string, string>()

  for (const p of productsSpec) {
    const slug = slugifyText(p.name)
    const category_id = categories.get(p.categorySlug)?.id ?? null

    let product = await Product.findOne({
      where: { org_id: orgId, slug },
      paranoid: false,
      transaction: t,
    })
    if (product) {
      if (product.deleted_at) await product.restore({ transaction: t })
      await product.update(
        {
          category_id,
          name: p.name,
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
          updated_by: actorId,
          deleted_by: null,
        },
        { transaction: t },
      )
    } else {
      product = await Product.create(
        {
          org_id: orgId, category_id, name: p.name, slug,
          description: null, short_description: null,
          product_type: p.product_type, status: 'active', vendor: null,
          iva_rate: p.iva_rate, unit_of_measure: p.unit_of_measure,
          ncm_code: null, tags: [], images: [],
          created_by: actorId, updated_by: actorId,
        },
        { transaction: t },
      )
    }

    for (let i = 0; i < p.variants.length; i++) {
      const v = p.variants[i]!
      const isDefault = i === 0
      let variant = await ProductVariant.findOne({
        where: { org_id: orgId, sku: v.sku },
        paranoid: false,
        transaction: t,
      })
      if (variant) {
        if (variant.deleted_at) await variant.restore({ transaction: t })
        await variant.update(
          {
            product_id: product.id,
            barcode: v.barcode ?? null,
            name: v.variantName,
            is_default: isDefault,
            base_price: v.price,
            manage_stock: v.manage_stock,
            stock_quantity: v.stock_quantity,
            sold_by_weight: v.sold_by_weight ?? false,
            plu_code: v.plu_code ?? null,
            updated_by: actorId,
            deleted_by: null,
          },
          { transaction: t },
        )
      } else {
        variant = await ProductVariant.create(
          {
            org_id: orgId, product_id: product.id, sku: v.sku,
            barcode: v.barcode ?? null, name: v.variantName,
            is_default: isDefault,
            cost_price: null, base_price: v.price,
            manage_stock: v.manage_stock, stock_quantity: v.stock_quantity,
            sold_by_weight: v.sold_by_weight ?? false,
            plu_code: v.plu_code ?? null,
            created_by: actorId, updated_by: actorId,
          },
          { transaction: t },
        )
      }
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

/** Balanza barcode config for POS testing (demo tenant). */
async function seedPosBalanzaDemo(orgId: string, t: import('sequelize').Transaction) {
  const [setting] = await OrganizationSetting.findOrCreate({
    where: { org_id: orgId },
    defaults: {
      org_id: orgId,
      enabled_modules: [...DEFAULT_ENABLED_MODULES],
      enabled_features: {},
      pos_config: {
        balanza: { ...DEFAULT_BALANZA_CONFIG, enabled: true },
      },
    },
    transaction: t,
  })

  const currentBalanza = setting.pos_config?.balanza
  if (!currentBalanza?.enabled) {
    await setting.update({
      pos_config: {
        ...(setting.pos_config ?? {}),
        balanza: { ...DEFAULT_BALANZA_CONFIG, enabled: true },
      },
    }, { transaction: t })
  }
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
  logSeedProgress(`inventario: ${trackableVariants.length} variantes con stock, ${branches.length} sucursales`)

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
        defaults: { variant_id: variant.id, warehouse_id: warehouse.id, org_id: orgId, quantity: '0' },
        transaction: t,
      })

      if (created && Number(qty) > 0) {
        await applyMovement({
          variantId:     variant.id,
          warehouseId:   warehouse.id,
          orgId,
          movementType:  'in',
          referenceType: 'initial',
          referenceId:   null,
          quantityDelta: new Decimal(qty),
          notes:         'Stock inicial (seed)',
          actorId,
          stockItem:     item,
          skipVariantStockSync: true,
          skipWooEnqueue:       true,
        }, t)
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
  const supplierPayment = await SupplierPayment.create(
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

  const purchaseCtx: TenantContext = {
    orgId,
    userId: actorId,
    defaultBranchId: branch.id,
    allowedBranchIds: [branch.id],
  }
  await postSupplierInvoiceAccounting(invoice.id, purchaseCtx, t)
  await postSupplierPaymentAccounting(supplierPayment.id, purchaseCtx, t)
}

type LogisticsOrderSeedSpec = {
  notes: string
  sku: string
  description: string
  quantity: string
  unit_price: string
  ship_to_name: string
  ship_street: string
  ship_number: string
  ship_city: string
  ship_province: string
  ship_postal_code: string
  promisedOffsetDays: number
}

function dateDaysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(12, 0, 0, 0)
  return date
}

async function findOrCreateLogisticsOrder(
  orgId: string,
  branch: Branch,
  actorId: string,
  contact: Contact,
  variantsBySku: Map<string, ProductVariant>,
  spec: LogisticsOrderSeedSpec,
  t: import('sequelize').Transaction,
): Promise<SalesOrder> {
  const existing = await SalesOrder.findOne({
    where: { org_id: orgId, notes: spec.notes },
    transaction: t,
  })
  if (existing) return existing

  const variant = variantsBySku.get(spec.sku)
  if (!variant) throw new Error(`Seed logística: variante ${spec.sku} no encontrada`)

  const iva_rate: IvaRate = '21'
  const line = {
    product_id:   variant.product_id,
    variant_id:   variant.id,
    description:  spec.description,
    quantity:     spec.quantity,
    unit_price:   spec.unit_price,
    discount_pct: '0.00',
    iva_rate,
    sort_order:   0,
  }
  const lineTotals = calcLineItem(line.quantity, line.unit_price, line.discount_pct, line.iva_rate)
  const docTotals = calcDocumentTotals([lineTotals])
  const order_number = await nextDocumentNumber(orgId, branch.id, 'order', t)
  const promisedDate = dateDaysFromNow(spec.promisedOffsetDays)

  const order = await SalesOrder.create(
    {
      org_id:               orgId,
      branch_id:            branch.id,
      contact_id:           contact.id,
      quote_id:             null,
      order_number,
      salesperson_id:       actorId,
      status:               'confirmed',
      payment_condition:    'cash',
      currency:             'ARS',
      promised_date:        promisedDate,
      delivered_date:       null,
      shipping_street:      spec.ship_street,
      shipping_number:      spec.ship_number,
      shipping_floor:       null,
      shipping_apartment:   null,
      shipping_city:        spec.ship_city,
      shipping_province:    spec.ship_province,
      shipping_postal_code: spec.ship_postal_code,
      shipping_country:     'Argentina',
      billing_street:       spec.ship_street,
      billing_number:       spec.ship_number,
      billing_floor:        null,
      billing_apartment:    null,
      billing_city:         spec.ship_city,
      billing_province:     spec.ship_province,
      billing_postal_code:  spec.ship_postal_code,
      billing_country:      'Argentina',
      subtotal:             docTotals.subtotal,
      discount_amount:      docTotals.discount_amount,
      tax_amount:           docTotals.tax_amount,
      total:                docTotals.total,
      notes:                spec.notes,
      internal_notes:       'Pedido creado por seed para probar salidas de reparto',
      created_by:           actorId,
      updated_by:           actorId,
    },
    { transaction: t },
  )

  await SalesOrderItem.create(
    {
      org_id:          orgId,
      order_id:        order.id,
      product_id:      line.product_id,
      variant_id:      line.variant_id,
      description:     line.description,
      quantity:        line.quantity,
      unit_price:      line.unit_price,
      discount_pct:    line.discount_pct,
      iva_rate:        line.iva_rate,
      subtotal:        lineTotals.subtotal,
      discount_amount: lineTotals.discount_amount,
      tax_base:        lineTotals.tax_base,
      tax_amount:      lineTotals.tax_amount,
      total:           lineTotals.total,
      sort_order:      line.sort_order,
      created_by:      actorId,
      updated_by:      actorId,
    },
    { transaction: t },
  )

  return order
}

async function seedLogisticsDemo(
  orgId: string,
  branch: Branch,
  actorId: string,
  variantsBySku: Map<string, ProductVariant>,
  t: import('sequelize').Transaction,
) {
  const existingRuns = await DeliveryRun.count({
    where: {
      org_id: orgId,
      notes: { [Op.in]: ['Salida de reparto de prueba — Zona Norte', 'Salida de reparto de prueba — Zona Oeste'] },
    },
    transaction: t,
  })
  if (existingRuns >= 2) return

  const customers = await Contact.findAll({
    where: {
      org_id: orgId,
      type: { [Op.in]: ['customer', 'both'] },
      is_active: true,
    },
    order: [['legal_name', 'ASC']],
    limit: 3,
    transaction: t,
  })
  if (customers.length === 0) return

  const [carrier] = await CarrierAccount.findOrCreate({
    where: { org_id: orgId, name: 'Reparto propio Demo' },
    defaults: {
      org_id: orgId,
      branch_id: branch.id,
      kind: 'in_house',
      name: 'Reparto propio Demo',
      is_active: true,
      settings: { flat_rate: 0 },
      created_by: actorId,
      updated_by: actorId,
    },
    transaction: t,
  })

  const vehicleRef = 'Camioneta Demo (AND 123)'
  await Vehicle.findOrCreate({
    where: { org_id: orgId, label: 'Camioneta Demo' },
    defaults: {
      org_id: orgId,
      branch_id: branch.id,
      label: 'Camioneta Demo',
      plate: 'AND123',
      notes: 'Vehículo creado por seed para salidas de reparto',
      is_active: true,
      created_by: actorId,
      updated_by: actorId,
    },
    transaction: t,
  })

  const orderSpecs: LogisticsOrderSeedSpec[] = [
    {
      notes: 'Pedido logística prueba — Palermo',
      sku: 'GUANTES-NIL-M',
      description: 'Guantes de nitrilo Talla M',
      quantity: '4',
      unit_price: '350.00',
      ship_to_name: customers[0]?.trade_name ?? customers[0]?.legal_name ?? 'Cliente Palermo',
      ship_street: 'Av. Santa Fe',
      ship_number: '3200',
      ship_city: 'CABA',
      ship_province: 'Buenos Aires',
      ship_postal_code: '1425',
      promisedOffsetDays: 0,
    },
    {
      notes: 'Pedido logística prueba — Belgrano',
      sku: 'MASCARILLA-SV',
      description: 'Mascarilla FFP2 sin válvula',
      quantity: '8',
      unit_price: '850.00',
      ship_to_name: customers[1]?.trade_name ?? customers[1]?.legal_name ?? customers[0]!.legal_name,
      ship_street: 'Av. Cabildo',
      ship_number: '2100',
      ship_city: 'CABA',
      ship_province: 'Buenos Aires',
      ship_postal_code: '1428',
      promisedOffsetDays: 0,
    },
    {
      notes: 'Pedido logística prueba — Villa Urquiza',
      sku: 'ALCOHOL-GEL-500',
      description: 'Alcohol en gel 500ml',
      quantity: '6',
      unit_price: '1200.00',
      ship_to_name: customers[2]?.trade_name ?? customers[2]?.legal_name ?? customers[0]!.legal_name,
      ship_street: 'Triunvirato',
      ship_number: '4300',
      ship_city: 'CABA',
      ship_province: 'Buenos Aires',
      ship_postal_code: '1431',
      promisedOffsetDays: 1,
    },
  ]

  const ctx: TenantContext = {
    orgId,
    userId: actorId,
    defaultBranchId: branch.id,
    allowedBranchIds: [branch.id],
    salesScopeOwn: false,
    logisticsScopeAssigned: false,
  }

  const shipmentIds: string[] = []
  for (let i = 0; i < orderSpecs.length; i++) {
    const spec = orderSpecs[i]!
    const contact = customers[i] ?? customers[0]!
    const order = await findOrCreateLogisticsOrder(orgId, branch, actorId, contact, variantsBySku, spec, t)
    const existingShipment = await Shipment.findOne({
      where: { org_id: orgId, sales_order_id: order.id },
      transaction: t,
    })
    if (existingShipment) {
      await createDeliveryNoteForShipment(existingShipment.id, orgId, actorId, t)
      shipmentIds.push(existingShipment.id)
      continue
    }

    const shipment = await createShipmentForOrder(
      {
        sales_order_id: order.id,
        carrier_account_id: carrier.id,
        promised_date: dateDaysFromNow(spec.promisedOffsetDays),
        assigned_driver_id: actorId,
        vehicle_ref: vehicleRef,
        ship_to_name: spec.ship_to_name,
        ship_street: spec.ship_street,
        ship_number: spec.ship_number,
        ship_city: spec.ship_city,
        ship_province: spec.ship_province,
        ship_postal_code: spec.ship_postal_code,
        ship_country: 'Argentina',
        delivery_notes: 'Envío creado por seed para probar salidas agrupadas',
      },
      ctx,
      actorId,
      t,
    ) as { id: string }
    await createDeliveryNoteForShipment(shipment.id, orgId, actorId, t)
    shipmentIds.push(shipment.id)
  }

  const zonaNorte = await DeliveryRun.findOne({
    where: { org_id: orgId, notes: 'Salida de reparto de prueba — Zona Norte' },
    transaction: t,
  })
  if (!zonaNorte && shipmentIds.length >= 2) {
    await createDeliveryRun(
      {
        shipment_ids: shipmentIds.slice(0, 2),
        planned_date: dateDaysFromNow(0),
        assigned_driver_id: actorId,
        vehicle_ref: vehicleRef,
        notes: 'Salida de reparto de prueba — Zona Norte',
      },
      ctx,
      actorId,
      t,
    )
  }

  const zonaOeste = await DeliveryRun.findOne({
    where: { org_id: orgId, notes: 'Salida de reparto de prueba — Zona Oeste' },
    transaction: t,
  })
  if (!zonaOeste && shipmentIds.length >= 3) {
    await createDeliveryRun(
      {
        shipment_ids: [shipmentIds[2]!],
        planned_date: dateDaysFromNow(1),
        assigned_driver_id: actorId,
        vehicle_ref: vehicleRef,
        notes: 'Salida de reparto de prueba — Zona Oeste',
      },
      ctx,
      actorId,
      t,
    )
  }
}

type SeedJournalLine = {
  code: string
  debit?: string
  credit?: string
  branchId?: string | null
  description?: string
}

/**
 * Asientos contables de prueba para el tenant demo.
 * Crea movimientos representativos de una PyME (aporte de capital, venta con IVA,
 * compra de mercadería, gasto con centro de costo y un borrador). Idempotente.
 */
async function seedAccountingEntries(
  orgId: string,
  branch: Branch,
  actorId: string,
  t: import('sequelize').Transaction,
) {
  const existing = await JournalEntry.findOne({ where: { org_id: orgId }, transaction: t })
  if (existing) return

  const accountRows = await Account.findAll({
    where: { org_id: orgId },
    attributes: ['id', 'code'],
    transaction: t,
  })
  const idByCode = new Map(accountRows.map(a => [a.code, a.id]))
  const acc = (code: string): string => {
    const id = idByCode.get(code)
    if (!id) throw new Error(`Seed contable: cuenta ${code} no encontrada`)
    return id
  }

  async function createEntry(opts: {
    date: string
    description: string
    status: 'draft' | 'posted'
    lines: SeedJournalLine[]
  }) {
    const entry_number = await nextEntryNumber(orgId, t)
    const totalDebit = opts.lines.reduce((s, l) => s + parseFloat(l.debit ?? '0'), 0)
    const totalCredit = opts.lines.reduce((s, l) => s + parseFloat(l.credit ?? '0'), 0)

    const entry = await JournalEntry.create(
      {
        org_id:       orgId,
        entry_number,
        entry_date:   opts.date as unknown as Date,
        description:  opts.description,
        status:       opts.status,
        total_debit:  totalDebit.toFixed(2),
        total_credit: totalCredit.toFixed(2),
        created_by:   actorId,
        updated_by:   actorId,
      },
      { transaction: t },
    )

    await JournalEntryLine.bulkCreate(
      opts.lines.map((l, idx) => ({
        org_id:      orgId,
        entry_id:    entry.id,
        account_id:  acc(l.code),
        branch_id:   l.branchId ?? null,
        description: l.description ?? null,
        debit:       l.debit ?? '0.00',
        credit:      l.credit ?? '0.00',
        sort_order:  idx,
        created_by:  actorId,
        updated_by:  actorId,
      })),
      { transaction: t },
    )
  }

  // 1. Aporte de capital inicial
  await createEntry({
    date: '2026-01-02',
    description: 'Aporte de capital inicial',
    status: 'posted',
    lines: [
      { code: '1.1.01.02', debit: '1000000.00', description: 'Acreditación en banco' },
      { code: '3.1.01',    credit: '1000000.00' },
    ],
  })

  // 2. Venta con IVA (21%)
  await createEntry({
    date: '2026-01-10',
    description: 'Venta de mercadería con IVA',
    status: 'posted',
    lines: [
      { code: '1.1.02.01', debit: '121000.00', description: 'Factura A 0001-00000001' },
      { code: '4.1.01',    credit: '100000.00' },
      { code: '2.1.02.01', credit: '21000.00' },
    ],
  })

  // 3. Compra de mercadería con IVA crédito fiscal
  await createEntry({
    date: '2026-01-15',
    description: 'Compra de mercadería a proveedor',
    status: 'posted',
    lines: [
      { code: '1.1.03.01', debit: '50000.00' },
      { code: '1.1.02.02', debit: '10500.00' },
      { code: '2.1.01.01', credit: '60500.00', description: 'Proveedor S.A.' },
    ],
  })

  // 4. Pago de alquiler imputado a una sucursal (centro de costo)
  await createEntry({
    date: '2026-01-31',
    description: 'Pago de alquiler del local',
    status: 'posted',
    lines: [
      { code: '5.2.05',    debit: '80000.00', branchId: branch.id, description: 'Alquiler enero' },
      { code: '1.1.01.02', credit: '80000.00', branchId: branch.id },
    ],
  })

  // 5. Gasto en borrador (sin contabilizar)
  await createEntry({
    date: '2026-02-03',
    description: 'Gastos varios de administración (borrador)',
    status: 'draft',
    lines: [
      { code: '5.2.02',    debit: '15000.00' },
      { code: '1.1.01.01', credit: '15000.00' },
    ],
  })
}

async function run() {
  // The seed can touch hundreds of rows; SQL logging makes successful runs look
  // stuck and slows them down. Set SEED_SQL_LOG=yes when debugging SQL.
  ;(sequelize as unknown as { options: { logging: false | typeof console.log } }).options.logging =
    process.env.SEED_SQL_LOG === 'yes' ? console.log : false

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
    logSeedProgress('permisos base')
    await ensurePermissionsSeeded(t)

    // sys-admin (no org)
    logSeedProgress('sys-admin')
    const sysHash = await hashPassword(seed.sysAdmin.password)
    const sysNameParts = splitLegacyUserName(seed.sysAdmin.name)
    const [sysAdmin, sysAdminCreated] = await User.findOrCreate({
      where: { email: seed.sysAdmin.email },
      defaults: {
        email: seed.sysAdmin.email,
        name: seed.sysAdmin.name,
        first_name: sysNameParts.firstName,
        last_name: sysNameParts.lastName,
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

    const billingPlansByCode = await seedBillingPlans(sysAdmin.id, t)
    await seedBillingMetrics(sysAdmin.id, t)
    await seedPlatformBillerSettings(t)

    for (const tenant of seed.tenants) {
      logSeedProgress(`${tenant.slug}: organizacion`)
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

      await seedDefaultOrgRoles(org.id, t)
      await ensureOrgRoleTemplates(
        org.id,
        DEFAULT_ORG_ROLE_TEMPLATES.map(template => template.name),
        t,
      )
      const orgRoles = await OrgRole.findAll({
        where: { org_id: org.id },
        attributes: ['id', 'name'],
        transaction: t,
        paranoid: true,
      })
      const orgRolesByName = new Map(orgRoles.map(r => [r.name, r.id]))

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

      if (tenant.slug === 'integration') {
        const [integrationSettings] = await OrganizationSetting.findOrCreate({
          where: { org_id: org.id },
          defaults: {
            org_id: org.id,
            enabled_modules: [...DEFAULT_ENABLED_MODULES],
            enabled_features: {},
          },
          transaction: t,
        })
        await integrationSettings.update(
          { enabled_modules: [...DEFAULT_ENABLED_MODULES] },
          { transaction: t },
        )
      }

      const planCode = SEED_PLAN_BY_ORG_SLUG[tenant.slug]
      if (planCode) {
        const seats = tenant.slug === 'demo' ? 8 : 3
        await seedOrgSubscription(org.id, planCode, seats, sysAdmin.id, billingPlansByCode, t)
      }

      const branches: Branch[] = []
      let defaultCustomerId: string | null = null
      let variantsBySku = new Map<string, ProductVariant>()
      let code = 1
      logSeedProgress(`${tenant.slug}: sucursales`)
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
        logSeedProgress(`${tenant.slug}: usuario ${u.email}`)
        const password_hash = await hashPassword(u.password)
        const defaultBranch = branches[u.branchIndex]!
        const { role, org_role_id } = resolveSeedUserRole(u, orgRolesByName)
        const userNameParts = splitLegacyUserName(u.name)
        const [user, userCreated] = await User.findOrCreate({
          where: { email: u.email },
          defaults: {
            email: u.email,
            name: u.name,
            first_name: userNameParts.firstName,
            last_name: userNameParts.lastName,
            password_hash,
            role,
            org_role_id,
            is_active: true,
            org_id: org.id,
            branch_id: defaultBranch.id,
          },
          transaction: t,
        })
        if (!userCreated) {
          await user.update(
            {
              name: u.name,
              role,
              org_role_id,
              org_id: org.id,
              branch_id: defaultBranch.id,
              is_active: true,
              ...(allowProd || tenant.slug === 'integration' ? { password_hash } : {}),
            },
            { transaction: t },
          )
        }

        const allowed = u.allowedBranchIndexes.map((idx) => branches[idx]!.id)
        for (const branch_id of allowed) {
          await UserBranch.findOrCreate({
            where: { user_id: user.id, branch_id },
            defaults: { user_id: user.id, branch_id },
            transaction: t,
          })
        }

        if (tenant.slug === 'integration' && u.email === INTEGRATION_TEST_USERS.admin.email) {
          logSeedProgress(`${tenant.slug}: catalogo`)
          variantsBySku = await seedIntegrationCatalog(org.id, user.id, t)
          logSeedProgress(`${tenant.slug}: contactos`)
          const contacts = await seedIntegrationContacts(org.id, user.id, t)
          const defaultCustomer = contacts.find((c) => c.legal_name === 'Cliente XYZ') ?? null
          defaultCustomerId = defaultCustomer?.id ?? null
          await seedInventory(org.id, branches, user.id, t)
          logSeedProgress(`${tenant.slug}: plan contable`)
          await seedDefaultChartOfAccounts(org.id, t, user.id)
          const defaultBranch = branches[0]!
          logSeedProgress(`${tenant.slug}: financieros`)
          await seedIntegrationFinancials(org.id, defaultBranch, user.id, contacts, variantsBySku, t)
          logSeedProgress(`${tenant.slug}: asientos`)
          await seedIntegrationAccounting(org.id, user.id, t)
          logSeedProgress(`${tenant.slug}: compras`)
          await seedIntegrationPurchases(org.id, defaultBranch, user.id, contacts, variantsBySku, t)
        } else if (isSeedGerente(u)) {
          logSeedProgress(`${tenant.slug}: catalogo`)
          variantsBySku = await seedCatalog(org.id, user.id, t)
          logSeedProgress(`${tenant.slug}: contactos`)
          const contacts = await seedContacts(org.id, user.id, t)
          const defaultCustomer = contacts.find(c => c.type === 'customer' || c.type === 'both') ?? null
          defaultCustomerId = defaultCustomer?.id ?? null
          await seedInventory(org.id, branches, user.id, t)
          logSeedProgress(`${tenant.slug}: plan contable`)
          await seedDefaultChartOfAccounts(org.id, t, user.id)

          // Purchases seed (demo tenant only)
          if (tenant.slug === 'demo') {
            const defaultBranch = branches[0]!
            logSeedProgress(`${tenant.slug}: POS balanza`)
            await seedPosBalanzaDemo(org.id, t)
            logSeedProgress(`${tenant.slug}: compras demo`)
            await seedPurchases(org.id, defaultBranch, user.id, variantsBySku, contacts, t)
            logSeedProgress(`${tenant.slug}: asientos demo`)
            await seedAccountingEntries(org.id, defaultBranch, user.id, t)
          }
        }

        // Seed a minimal sales flow for the first user of the first tenant only
        if (tenant.slug === 'demo' && u.email === 'admin@demo.local') {
          // Only create the sample docs if they don't exist yet.
          const existing = await SalesQuote.findOne({ where: { org_id: org.id, notes: 'Presupuesto de prueba' }, transaction: t })
          if (existing) {
            logSeedProgress(`${tenant.slug}: logistica demo`)
            await seedLogisticsDemo(org.id, defaultBranch, user.id, variantsBySku, t)
            continue
          }

          logSeedProgress(`${tenant.slug}: ventas demo`)
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
          const payment = await Payment.create(
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

          const salesCtx: TenantContext = {
            orgId: org.id,
            userId: user.id,
            defaultBranchId: defaultBranch.id,
            allowedBranchIds: [defaultBranch.id],
          }
          await postInvoiceIssuedAccounting(invoice.id, salesCtx, t, { invoice })
          await postSalesPaymentAccounting(payment.id, salesCtx, t, { payment })

          logSeedProgress(`${tenant.slug}: logistica demo`)
          await seedLogisticsDemo(org.id, defaultBranch, user.id, variantsBySku, t)
        }
      }
    }
  })

  if (allowProd) {
    console.log('Prod seed completed.')
    console.log('Users created/updated. Passwords loaded from SEED_* env vars (not printed).')
    console.log(`  sys-admin: ${seed.sysAdmin.email}`)
    console.log('Billing plans:')
    for (const line of seedPlanSummaryLines()) console.log(line)
    console.log(seedBillerSummaryLine())
    console.log(seedMetricsSummaryLine())
    console.log('  demo: admin@demo.local (Gerente), op@demo.local (Vendedor)')
    console.log('  premium: admin@premium.local (Gerente)')
  } else {
    console.log('Dev seed completed.')
    console.log(`Sys-admin: ${seed.sysAdmin.email} / ${seed.sysAdmin.password}`)
    console.log('Billing plans:')
    for (const line of seedPlanSummaryLines()) console.log(line)
    console.log(seedBillerSummaryLine())
    console.log(seedMetricsSummaryLine())
    console.log('Tenant demo (password demo12345 for all):')
    console.log('  admin@demo.local — Gerente')
    console.log('  op@demo.local — Vendedor')
    console.log('  cajero@demo.local — Cajero')
    console.log('  sucursal@demo.local — Encargado de sucursal')
    console.log('  compras@demo.local — Gerente de compras')
    console.log('  contador@demo.local — Contador')
    console.log('  deposito@demo.local — Depósito')
    console.log(`Tenant premium: admin@premium.local / ${seed.tenants[1]!.users[0]!.password}`)
    console.log(
      `Tenant integration: ${INTEGRATION_TEST_USERS.admin.email} / ${INTEGRATION_TEST_USERS.admin.password}`,
    )
    console.log('  (also: test-gerente, test-vendedor, test-comprador, test-contador @andiko.local — same password)')
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())

