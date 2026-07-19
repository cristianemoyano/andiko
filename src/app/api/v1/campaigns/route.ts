import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { campaignSchema, campaignQuerySchema } from '@/modules/campaigns/campaign.schema'
import { listCampaigns, createCampaign } from '@/modules/campaigns/campaigns.service'

export const GET = withTenantPermission('campaigns:read', async (req, _ctx, _session, tenant) => {
  const parsed = campaignQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
  }
  const result = await listCampaigns(parsed.data, tenant)
  return NextResponse.json(result)
})

export const POST = withTenantPermission('campaigns:write', async (req, _ctx, session, tenant) => {
  const parsed = campaignSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  const campaign = await createCampaign(parsed.data, tenant, resolveActorId(session))
  return NextResponse.json(campaign, { status: 201 })
})
