/**
 * Idempotent financial seed for the integration tenant only.
 * Use when `pnpm db:seed-dev` fails on catalog but receivables data is missing.
 */
import sequelize from '@/lib/db'
import Organization from '@/modules/auth/organization.model'
import Branch from '@/modules/auth/branch.model'
import User from '@/modules/auth/user.model'
import Contact from '@/modules/contacts/contact.model'
import ProductVariant from '@/modules/catalog/product-variant.model'
import { INTEGRATION_TENANT, INTEGRATION_TEST_USERS } from './integration-seed-data'
import { seedIntegrationFinancials, seedIntegrationAccounting } from './integration-seed'

async function main(): Promise<void> {
  await sequelize.transaction(async (t) => {
    const org = await Organization.findOne({
      where: { slug: INTEGRATION_TENANT.slug },
      transaction: t,
    })
    if (!org) throw new Error(`Org "${INTEGRATION_TENANT.slug}" not found`)

    const branch = await Branch.findOne({
      where: { org_id: org.id },
      order: [['created_at', 'ASC']],
      transaction: t,
    })
    if (!branch) throw new Error('Integration branch not found')

    const user = await User.findOne({
      where: { org_id: org.id, email: INTEGRATION_TEST_USERS.admin.email },
      transaction: t,
    })
    if (!user) throw new Error('Integration admin user not found')

    const contacts = await Contact.findAll({
      where: { org_id: org.id },
      transaction: t,
    })

    const variant = await ProductVariant.findOne({
      where: { org_id: org.id, sku: 'RES-001' },
      transaction: t,
    })
    const variantsBySku = new Map<string, ProductVariant>()
    if (variant) variantsBySku.set('RES-001', variant)

    await seedIntegrationFinancials(org.id, branch, user.id, contacts, variantsBySku, t)
    await seedIntegrationAccounting(org.id, user.id, t)
  })

  console.log('Integration financials + accounting seed complete.')
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })
