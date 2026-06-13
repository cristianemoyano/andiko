// No `server-only` here on purpose: this helper is imported both from the
// (server-only) accounts service and from the tsx-run dev seed script, so it
// must stay runtime-agnostic. It only touches the Account model + db.
import type { Transaction } from 'sequelize'
import Account from './account.model'
import { DEFAULT_CHART_OF_ACCOUNTS } from './default-chart'

/**
 * Idempotent seed of the default Argentine PyME chart of accounts.
 * No-op if the organization already has any account. Returns the number of
 * accounts created.
 */
export async function seedDefaultChartOfAccounts(
  orgId: string,
  t: Transaction,
  actorId: string | null = null,
): Promise<number> {
  const existing = await Account.count({ where: { org_id: orgId }, transaction: t, paranoid: false })
  if (existing > 0) return 0

  const codeToId = new Map<string, string>()
  for (const def of DEFAULT_CHART_OF_ACCOUNTS) {
    const parentId = def.parent_code ? codeToId.get(def.parent_code) ?? null : null
    const account = await Account.create(
      {
        code:        def.code,
        name:        def.name,
        type:        def.type,
        parent_id:   parentId,
        is_postable: def.is_postable,
        is_active:   true,
        org_id:      orgId,
        created_by:  actorId,
        updated_by:  actorId,
      },
      { transaction: t },
    )
    codeToId.set(def.code, account.id)
  }

  return DEFAULT_CHART_OF_ACCOUNTS.length
}
