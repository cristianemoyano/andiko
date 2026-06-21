import pg from 'pg'
import { INTEGRATION_PRODUCTS, INTEGRATION_TENANT } from '@/db/dev/integration-seed-data'
import { slugifyText } from '@/lib/slug'

/**
 * Clears supplier invoices/payments from prior E2E runs so cuenta corriente assertions stay deterministic.
 */
export async function resetIntegrationSupplierLedger(supplierLegalName: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to reset supplier ledger.')
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const orgRes = await client.query<{ id: string }>(
      'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
      [INTEGRATION_TENANT.slug],
    )
    const orgId = orgRes.rows[0]?.id
    if (!orgId) return

    const contactRes = await client.query<{ id: string }>(
      'SELECT id FROM contacts WHERE org_id = $1 AND legal_name = $2 LIMIT 1',
      [orgId, supplierLegalName],
    )
    const contactId = contactRes.rows[0]?.id
    if (!contactId) return

    await client.query(
      `UPDATE supplier_payments
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE org_id = $1 AND contact_id = $2 AND deleted_at IS NULL`,
      [orgId, contactId],
    )
    await client.query(
      `UPDATE supplier_invoices
       SET deleted_at = NOW(), status = 'cancelled', updated_at = NOW()
       WHERE org_id = $1 AND contact_id = $2 AND deleted_at IS NULL`,
      [orgId, contactId],
    )
  } finally {
    await client.end()
  }
}

/**
 * Restores integration catalog products soft-deleted by other E2E scenarios
 * (e.g. catalog delete tests). Keeps purchase/sales flows independent of run order.
 */
export async function ensureIntegrationCatalogProducts(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to restore integration catalog products.')
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const orgRes = await client.query<{ id: string }>(
      'SELECT id FROM organizations WHERE slug = $1 LIMIT 1',
      [INTEGRATION_TENANT.slug],
    )
    const orgId = orgRes.rows[0]?.id
    if (!orgId) {
      throw new Error(`Org "${INTEGRATION_TENANT.slug}" no encontrada — ejecutá pnpm db:seed-dev`)
    }

    for (const product of INTEGRATION_PRODUCTS) {
      const slug = slugifyText(product.name)
      await client.query(
        `UPDATE product_variants
         SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
         WHERE org_id = $1 AND sku = $2`,
        [orgId, product.sku],
      )
      await client.query(
        `UPDATE products
         SET deleted_at = NULL, deleted_by = NULL, status = 'active', updated_at = NOW()
         WHERE org_id = $1 AND slug = $2`,
        [orgId, slug],
      )
    }
  } finally {
    await client.end()
  }
}
