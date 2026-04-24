import 'server-only'
import type { TenantContext } from '@/lib/tenancy'

type OrgBranchDoc = {
  org_id: string | null
  branch_id: string | null
}

export function assertPrintAccess(doc: OrgBranchDoc, ctx: TenantContext): void {
  if (doc.org_id !== ctx.orgId) {
    throw new Error('NOT_FOUND')
  }
  if (ctx.allowedBranchIds.length > 0) {
    const bid = doc.branch_id
    if (!bid || !ctx.allowedBranchIds.includes(bid)) {
      throw new Error('NOT_FOUND')
    }
  }
}
