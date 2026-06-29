import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api-handler'
import { listSharePrincipalOptions } from '@/modules/storage/share-principals.service'

/** Users, custom roles, and branches for the file-sharing picker. */
export const GET = withTenantAuth(async (_req, _ctx, _session, tenant) => {
  const data = await listSharePrincipalOptions(tenant.orgId)
  return NextResponse.json({ data })
})
