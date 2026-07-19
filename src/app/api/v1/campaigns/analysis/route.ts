import { NextResponse } from 'next/server'
import { withTenantPermission } from '@/lib/api-handler'
import { analysisSchema } from '@/modules/campaigns/campaign.schema'
import { analyzeCampaign } from '@/modules/campaigns/campaign-analysis.service'

export const POST = withTenantPermission('campaigns:read', async (req, _ctx, _session, tenant) => {
  const parsed = analysisSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const result = await analyzeCampaign(
      { campaignId: parsed.data.campaign_id, draft: parsed.data.campaign, windowDays: parsed.data.window_days },
      tenant,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND') {
      return NextResponse.json({ error: 'Campaña no encontrada.', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
    }
    throw err
  }
})
