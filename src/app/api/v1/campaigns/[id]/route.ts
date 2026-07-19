import { NextResponse } from 'next/server'
import { withTenantPermission, resolveActorId } from '@/lib/api-handler'
import { campaignUpdateSchema } from '@/modules/campaigns/campaign.schema'
import { getCampaign, updateCampaign, deleteCampaign } from '@/modules/campaigns/campaigns.service'

type P = { id: string }

function notFound(err: unknown): NextResponse | null {
  if (err instanceof Error && err.message === 'CAMPAIGN_NOT_FOUND') {
    return NextResponse.json({ error: 'Campaña no encontrada.', code: 'CAMPAIGN_NOT_FOUND' }, { status: 404 })
  }
  return null
}

export const GET = withTenantPermission<P>('campaigns:read', async (_req, ctx, _session, tenant) => {
  const { id } = await ctx.params
  try {
    const campaign = await getCampaign(id, tenant)
    return NextResponse.json(campaign)
  } catch (err) {
    const nf = notFound(err)
    if (nf) return nf
    throw err
  }
})

export const PATCH = withTenantPermission<P>('campaigns:write', async (req, ctx, session, tenant) => {
  const { id } = await ctx.params
  const parsed = campaignUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 })
  }
  try {
    const campaign = await updateCampaign(id, parsed.data, tenant, resolveActorId(session))
    return NextResponse.json(campaign)
  } catch (err) {
    const nf = notFound(err)
    if (nf) return nf
    throw err
  }
})

export const DELETE = withTenantPermission<P>('campaigns:delete', async (_req, ctx, session, tenant) => {
  const { id } = await ctx.params
  try {
    await deleteCampaign(id, tenant, resolveActorId(session))
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const nf = notFound(err)
    if (nf) return nf
    throw err
  }
})
