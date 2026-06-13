import { QueryTypes } from 'sequelize'
import type { Migration } from '../../lib/migrations'
import { DEFAULT_CHART_OF_ACCOUNTS } from '../../modules/accounting/default-chart'

export const up: Migration = async ({ context: queryInterface }) => {
  const sequelize = queryInterface.sequelize

  const orgs = await sequelize.query<{ id: string }>(
    `SELECT id FROM organizations WHERE deleted_at IS NULL`,
    { type: QueryTypes.SELECT },
  )

  for (const org of orgs) {
    const existing = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM accounts WHERE org_id = :orgId AND deleted_at IS NULL`,
      { type: QueryTypes.SELECT, replacements: { orgId: org.id } },
    )
    if (Number(existing[0]?.count ?? 0) > 0) continue

    const codeToId = new Map<string, string>()
    for (const account of DEFAULT_CHART_OF_ACCOUNTS) {
      const parentId = account.parent_code ? codeToId.get(account.parent_code) ?? null : null
      const inserted = await sequelize.query<{ id: string }>(
        `INSERT INTO accounts (org_id, parent_id, code, name, type, is_postable, is_active)
         VALUES (:orgId, :parentId, :code, :name, :type, :isPostable, TRUE)
         RETURNING id`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            orgId: org.id,
            parentId,
            code: account.code,
            name: account.name,
            type: account.type,
            isPostable: account.is_postable,
          },
        },
      )
      codeToId.set(account.code, inserted[0]!.id)
    }
  }
}

export const down: Migration = async ({ context: queryInterface }) => {
  // Reversible and safe: only remove seeded default accounts that never received
  // any journal line. Custom accounts and any account with movements are kept.
  const codes = DEFAULT_CHART_OF_ACCOUNTS.map(a => a.code)
  await queryInterface.sequelize.query(
    `DELETE FROM accounts
     WHERE code IN (:codes)
       AND id NOT IN (SELECT DISTINCT account_id FROM journal_entry_lines)`,
    { replacements: { codes } },
  )
}
