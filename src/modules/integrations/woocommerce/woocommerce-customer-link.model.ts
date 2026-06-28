import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export interface WoocommerceCustomerLinkAttributes {
  id: UUID
  org_id: UUID
  site_id: UUID
  woo_customer_id: string
  contact_id: UUID
  last_synced_at: Date | null
  created_at: Date
  updated_at: Date
}

type WoocommerceCustomerLinkCreationAttributes = Optional<
  WoocommerceCustomerLinkAttributes,
  'id' | 'last_synced_at' | 'created_at' | 'updated_at'
>

class WoocommerceCustomerLink extends Model<
  WoocommerceCustomerLinkAttributes,
  WoocommerceCustomerLinkCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare site_id: UUID
  declare woo_customer_id: string
  declare contact_id: UUID
  declare last_synced_at: Date | null
  declare created_at: Date
  declare updated_at: Date
}

WoocommerceCustomerLink.init(
  {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:          { type: DataTypes.UUID, allowNull: false },
    site_id:         { type: DataTypes.UUID, allowNull: false },
    woo_customer_id: { type: DataTypes.BIGINT, allowNull: false },
    contact_id:      { type: DataTypes.UUID, allowNull: false },
    last_synced_at:  { type: DataTypes.DATE },
    created_at:      { type: DataTypes.DATE, allowNull: false },
    updated_at:      { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'woocommerce_customer_links', paranoid: false, underscored: true }
)

export default WoocommerceCustomerLink
