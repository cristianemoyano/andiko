import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export interface WoocommerceProductLinkAttributes {
  id: UUID
  org_id: UUID
  site_id: UUID
  variant_id: UUID
  woo_product_id: string
  woo_variation_id: string | null
  last_pushed_hash: string | null
  last_pushed_at: Date | null
  created_at: Date
  updated_at: Date
}

type WoocommerceProductLinkCreationAttributes = Optional<
  WoocommerceProductLinkAttributes,
  'id' | 'woo_variation_id' | 'last_pushed_hash' | 'last_pushed_at' | 'created_at' | 'updated_at'
>

class WoocommerceProductLink extends Model<
  WoocommerceProductLinkAttributes,
  WoocommerceProductLinkCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare site_id: UUID
  declare variant_id: UUID
  declare woo_product_id: string
  declare woo_variation_id: string | null
  declare last_pushed_hash: string | null
  declare last_pushed_at: Date | null
  declare created_at: Date
  declare updated_at: Date
}

WoocommerceProductLink.init(
  {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:           { type: DataTypes.UUID, allowNull: false },
    site_id:          { type: DataTypes.UUID, allowNull: false },
    variant_id:       { type: DataTypes.UUID, allowNull: false },
    woo_product_id:   { type: DataTypes.BIGINT, allowNull: false },
    woo_variation_id: { type: DataTypes.BIGINT },
    last_pushed_hash: { type: DataTypes.STRING(64) },
    last_pushed_at:   { type: DataTypes.DATE },
    created_at:       { type: DataTypes.DATE, allowNull: false },
    updated_at:       { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'woocommerce_product_links', paranoid: false, underscored: true }
)

export default WoocommerceProductLink
