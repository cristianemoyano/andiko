import sequelize from '@/lib/db'

const TABLES = [
  // sales
  'payments',
  'invoice_items',
  'invoices',
  'sales_order_items',
  'sales_orders',
  'sales_quote_items',
  'sales_quotes',
  'document_sequences',

  // contacts
  'contact_payment_info',
  'contact_addresses',
  'contacts',

  // catalog
  'price_list_items',
  'price_lists',
  'product_variants',
  'products',
  'product_categories',

  // auth / tenancy
  'user_branches',
  'users',
  'branches',
  'organizations',
] as const

async function run() {
  // Dev safety: this is destructive to data.
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('clear-data is only allowed in development')
  }

  const list = TABLES.map((t) => `"${t}"`).join(', ')
  await sequelize.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
  console.log(`Cleared data from ${TABLES.length} tables.`)
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())

