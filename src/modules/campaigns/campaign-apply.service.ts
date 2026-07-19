import 'server-only'
import { type Transaction } from 'sequelize'
import logger from '@/lib/logger'
import Campaign from './campaign.model'
import Coupon from './coupon.model'
import CampaignApplication from './campaign-application.model'
import CouponRedemption from './coupon-redemption.model'
import type { CampaignDocumentType } from './campaign.constants'
import type { ResolveResult } from './campaign-resolver.types'

export interface CommitDocRef {
  type: CampaignDocumentType
  id: string
  contactId?: string | null
}

/**
 * Registra las aplicaciones de campaña de una venta DENTRO de su transacción.
 * Escribe `campaign_applications`, y para las gatilladas por cupón registra el
 * canje e incrementa contadores bajo lock. Idempotente por (coupon_id, document_id).
 */
export async function commitCampaignApplications(
  result: ResolveResult,
  doc: CommitDocRef,
  orgId: string,
  actorId: string,
  t: Transaction,
): Promise<void> {
  if (result.applications.length === 0) return

  for (const app of result.applications) {
    await CampaignApplication.create(
      {
        org_id: orgId,
        campaign_id: app.campaign_id,
        coupon_id: app.coupon_id,
        document_type: doc.type,
        document_id: doc.id,
        applied_discount_amount: app.applied_discount_amount,
        benefit_snapshot: app.benefit_snapshot,
        rule_snapshot: app.rule_snapshot,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    // Incrementa uso global de la campaña bajo lock.
    const campaign = await Campaign.findOne({
      where: { id: app.campaign_id, org_id: orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (campaign) {
      await campaign.update({ uses_count: campaign.uses_count + 1 }, { transaction: t })
    }

    if (!app.coupon_id) continue

    // Canje idempotente + incremento de cupón bajo lock.
    const existing = await CouponRedemption.findOne({
      where: { coupon_id: app.coupon_id, document_id: doc.id, org_id: orgId },
      transaction: t,
    })
    if (existing) continue

    await CouponRedemption.create(
      {
        org_id: orgId,
        coupon_id: app.coupon_id,
        campaign_id: app.campaign_id,
        contact_id: doc.contactId ?? null,
        document_type: doc.type,
        document_id: doc.id,
        discount_amount: app.applied_discount_amount,
        created_by: actorId,
        updated_by: actorId,
      },
      { transaction: t },
    )

    const coupon = await Coupon.findOne({
      where: { id: app.coupon_id, org_id: orgId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    })
    if (coupon) {
      await coupon.update({ redeemed_count: coupon.redeemed_count + 1 }, { transaction: t })
    }
  }

  logger.info(
    { documentType: doc.type, documentId: doc.id, applications: result.applications.length, orgId },
    'campaign applications committed',
  )
}
