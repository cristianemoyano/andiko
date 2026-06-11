import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id:         text('id').primaryKey(),
  sku:        text('sku'),
  barcode:    text('barcode'),
  name:       text('name').notNull(),
  price:      text('price').notNull(),      // stored as string, NUMERIC precision
  iva_rate:   text('iva_rate').notNull(),
  is_active:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  image_url:  text('image_url'),
  synced_at:  text('synced_at').notNull(),  // ISO timestamp from cloud
})

export const customers = sqliteTable('customers', {
  id:         text('id').primaryKey(),
  legal_name: text('legal_name').notNull(),
  trade_name: text('trade_name'),
  cuit:       text('cuit'),
  email:      text('email'),
  phone:      text('phone'),
  synced_at:  text('synced_at').notNull(),
})

export const posUsers = sqliteTable('pos_users', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull(),
  email:      text('email').notNull(),
  role:       text('role').notNull(),
  branch_id:  text('branch_id'),
  pos_pin_hash: text('pos_pin_hash'),
  synced_at:  text('synced_at').notNull(), // ISO timestamp from cloud (user.updated_at)
})

export const sales = sqliteTable('sales', {
  id:             text('id').primaryKey(),  // local UUID
  customer_id:    text('customer_id'),
  cashier_user_id: text('cashier_user_id'),
  cashier_name:   text('cashier_name'),
  payments:       text('payments').notNull().default('[]'), // JSON: PosSalePayment[]
  subtotal:       text('subtotal').notNull(),
  tax_amount:     text('tax_amount').notNull(),
  total:          text('total').notNull(),
  sold_at:        text('sold_at').notNull(),
  cloud_id:       text('cloud_id'),         // set after sync
  synced_at:      text('synced_at'),
})

export const saleItems = sqliteTable('sale_items', {
  id:           integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sale_id:      text('sale_id').notNull().references(() => sales.id),
  product_id:   text('product_id').notNull(),
  product_name: text('product_name').notNull(),
  qty:          real('qty').notNull(),
  iva_rate:     text('iva_rate').notNull().default('21'),
  unit_price:   text('unit_price').notNull(),
  total:        text('total').notNull(),
})

export const posDraftSales = sqliteTable('pos_draft_sales', {
  id:             text('id').primaryKey(),
  status:         text('status').notNull().default('draft'), // draft|abandoned|paid|cancelled
  cashier_user_id: text('cashier_user_id'),
  cashier_name:   text('cashier_name'),
  customer_id:    text('customer_id'),
  payments:       text('payments').default('[]'), // JSON: PosSalePayment[] (null while draft)
  subtotal:       text('subtotal').notNull().default('0'),
  tax_amount:     text('tax_amount').notNull().default('0'),
  total:          text('total').notNull().default('0'),
  last_opened_at: text('last_opened_at'),
  created_at:     text('created_at').notNull(),
  updated_at:     text('updated_at').notNull(),
})

export const posDraftSaleItems = sqliteTable('pos_draft_sale_items', {
  id:           integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  draft_sale_id: text('draft_sale_id').notNull().references(() => posDraftSales.id),
  product_id:   text('product_id').notNull(),
  product_name: text('product_name').notNull(),
  qty:          real('qty').notNull(),
  iva_rate:     text('iva_rate').notNull().default('21'),
  unit_price:   text('unit_price').notNull(),
  total:        text('total').notNull(),
  sort_order:   integer('sort_order', { mode: 'number' }).notNull().default(0),
})

export const syncQueue = sqliteTable('sync_queue', {
  id:         integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sale_id:    text('sale_id').notNull().references(() => sales.id),
  attempts:   integer('attempts').notNull().default(0),
  last_error: text('last_error'),
  created_at: text('created_at').notNull(),
})

export const licenseCache = sqliteTable('license_cache', {
  id:         integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  org_id:     text('org_id').notNull(),
  branch_id:  text('branch_id').notNull(),
  valid_until: text('valid_until').notNull(),
  cached_at:  text('cached_at').notNull(),
  features:   text('features').notNull().default('[]'), // JSON array
})

export const settings = sqliteTable('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
})

export const posPaymentMethods = sqliteTable('pos_payment_methods', {
  id:                 text('id').primaryKey(),  // cloud UUID
  name:               text('name').notNull(),
  type:               text('type').notNull(),
  requires_reference: integer('requires_reference', { mode: 'boolean' }).notNull().default(false),
  sort_order:         integer('sort_order', { mode: 'number' }).notNull().default(0),
  synced_at:          text('synced_at').notNull(),
})

export const cashSessions = sqliteTable('cash_sessions', {
  id:                        text('id').primaryKey(),
  cashier_user_id:           text('cashier_user_id'),
  cashier_name:              text('cashier_name'),
  opened_at:                 text('opened_at').notNull(),
  closed_at:                 text('closed_at'),
  opening_amount:            text('opening_amount').notNull().default('0'),
  closing_amount_declared:   text('closing_amount_declared'),
  closing_amount_expected:   text('closing_amount_expected'),
  difference:                text('difference'),
  status:                    text('status').notNull().default('open'), // 'open' | 'closed'
  cloud_id:                  text('cloud_id'),
  synced_at:                 text('synced_at'),
})
