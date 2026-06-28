import 'server-only'
import { fn, col, type Transaction } from 'sequelize'
import User from '@/modules/auth/user.model'
import Branch from '@/modules/auth/branch.model'

export async function countActiveUsers(orgId: string, t?: Transaction): Promise<number> {
  return User.count({
    where: { org_id: orgId, is_active: true },
    paranoid: true,
    transaction: t,
  })
}

export async function countActiveBranches(orgId: string, t?: Transaction): Promise<number> {
  return Branch.count({
    where: { org_id: orgId, is_active: true },
    paranoid: true,
    transaction: t,
  })
}

export async function countActiveSites(orgId: string, t?: Transaction): Promise<number> {
  const WoocommerceSite = (await import('@/modules/integrations/woocommerce/woocommerce-site.model')).default
  return WoocommerceSite.count({
    where: { org_id: orgId, is_active: true },
    paranoid: true,
    transaction: t,
  })
}

/**
 * Storage footprint for an org: total bytes and file count of available (non-deleted) files.
 * Used by the storage-usage rollup to meter `storage_gb` / `storage_files`. `paranoid: true`
 * excludes soft-deleted rows.
 */
export async function countStorageUsage(
  orgId: string,
  t?: Transaction,
): Promise<{ bytes: string; files: number }> {
  const FileModel = (await import('@/modules/storage/file.model')).default
  const row = (await FileModel.findOne({
    where: { org_id: orgId, status: 'available' },
    attributes: [
      [fn('COALESCE', fn('SUM', col('byte_size')), 0), 'bytes'],
      [fn('COUNT', col('id')), 'files'],
    ],
    paranoid: true,
    raw: true,
    transaction: t,
  })) as unknown as { bytes: string | number | null; files: string | number | null } | null

  return {
    bytes: String(row?.bytes ?? 0),
    files: Number(row?.files ?? 0),
  }
}
