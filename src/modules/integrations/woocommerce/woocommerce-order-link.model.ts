import { DataTypes, Model, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export const WOO_ORDER_SYNC_STATUSES = ['pending', 'synced', 'needs_review', 'error'] as const
export type WooOrderSyncStatus = typeof WOO_ORDER_SYNC_STATUSES[number]

export interface WoocommerceOrderLinkAttributes {
  id: UUID
  org_id: UUID
  site_id: UUID
  woo_order_id: string
  sales_order_id: UUID | null
  woo_status: string | null
  sync_status: WooOrderSyncStatus
  error_message: string | null
  processed_at: Date | null
  created_at: Date
  updated_at: Date
}

type WoocommerceOrderLinkCreationAttributes = Optional<
  WoocommerceOrderLinkAttributes,
  | 'id' | 'sales_order_id' | 'woo_status' | 'sync_status' | 'error_message'
  | 'processed_at' | 'created_at' | 'updated_at'
>

class WoocommerceOrderLink extends Model<
  WoocommerceOrderLinkAttributes,
  WoocommerceOrderLinkCreationAttributes
> {
  declare id: UUID
  declare org_id: UUID
  declare site_id: UUID
  declare woo_order_id: string
  declare sales_order_id: UUID | null
  declare woo_status: string | null
  declare sync_status: WooOrderSyncStatus
  declare error_message: string | null
  declare processed_at: Date | null
  declare created_at: Date
  declare updated_at: Date
}

WoocommerceOrderLink.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id:         { type: DataTypes.UUID, allowNull: false },
    site_id:        { type: DataTypes.UUID, allowNull: false },
    woo_order_id:   { type: DataTypes.BIGINT, allowNull: false },
    sales_order_id: { type: DataTypes.UUID },
    woo_status:     { type: DataTypes.STRING(40) },
    sync_status:    { type: DataTypes.ENUM(...WOO_ORDER_SYNC_STATUSES), allowNull: false, defaultValue: 'pending' },
    error_message:  { type: DataTypes.TEXT },
    processed_at:   { type: DataTypes.DATE },
    created_at:     { type: DataTypes.DATE, allowNull: false },
    updated_at:     { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'woocommerce_order_links', paranoid: false, underscored: true }
)

export default WoocommerceOrderLink
