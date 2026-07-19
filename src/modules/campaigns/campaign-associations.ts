import 'server-only'
import Campaign from './campaign.model'
import CampaignTarget from './campaign-target.model'
import CampaignPaymentRule from './campaign-payment-rule.model'
import Coupon from './coupon.model'
import CouponRedemption from './coupon-redemption.model'
import CampaignApplication from './campaign-application.model'

let registered = false

/**
 * Registers Campaign ↔ child associations.
 * Uses a flag so Sequelize doesn't log "already associated" warnings on
 * hot-module reloads in dev, while ensuring a single registration per process.
 */
export function ensureCampaignAssociations(): void {
  if (registered) return
  registered = true

  Campaign.hasMany(CampaignTarget, { foreignKey: 'campaign_id', as: 'targets' })
  CampaignTarget.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' })

  Campaign.hasMany(CampaignPaymentRule, { foreignKey: 'campaign_id', as: 'paymentRules' })
  CampaignPaymentRule.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' })

  Campaign.hasMany(Coupon, { foreignKey: 'campaign_id', as: 'coupons' })
  Coupon.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' })

  Campaign.hasMany(CampaignApplication, { foreignKey: 'campaign_id', as: 'applications' })
  CampaignApplication.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' })

  Coupon.hasMany(CouponRedemption, { foreignKey: 'coupon_id', as: 'redemptions' })
  CouponRedemption.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' })
}
