import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export interface WoocommerceSiteAttributes extends Timestamps, AuditFields {
  id: UUID
  org_id: UUID | null
  branch_id: UUID
  name: string
  store_url: string
  consumer_key_encrypted: string
  consumer_secret_encrypted: string
  webhook_secret_encrypted: string | null
  price_list_id: UUID | null
  default_contact_id: UUID | null
  auto_publish: boolean
  stock_safety_buffer: string
  is_active: boolean
  last_order_synced_at: Date | null
  last_stock_pushed_at: Date | null
}

type WoocommerceSiteCreationAttributes = Optional<
  WoocommerceSiteAttributes,
  | 'id' | 'webhook_secret_encrypted' | 'price_list_id' | 'default_contact_id'
  | 'auto_publish' | 'stock_safety_buffer' | 'is_active'
  | 'last_order_synced_at' | 'last_stock_pushed_at'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by' | 'org_id'
>

class WoocommerceSite extends AuditModel<WoocommerceSiteAttributes, WoocommerceSiteCreationAttributes> {
  declare id: UUID
  declare branch_id: UUID
  declare name: string
  declare store_url: string
  declare consumer_key_encrypted: string
  declare consumer_secret_encrypted: string
  declare webhook_secret_encrypted: string | null
  declare price_list_id: UUID | null
  declare default_contact_id: UUID | null
  declare auto_publish: boolean
  declare stock_safety_buffer: string
  declare is_active: boolean
  declare last_order_synced_at: Date | null
  declare last_stock_pushed_at: Date | null
}

WoocommerceSite.init(
  {
    id:                        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    branch_id:                 { type: DataTypes.UUID, allowNull: false },
    name:                      { type: DataTypes.STRING(255), allowNull: false },
    store_url:                 { type: DataTypes.STRING(500), allowNull: false },
    consumer_key_encrypted:    { type: DataTypes.TEXT, allowNull: false },
    consumer_secret_encrypted: { type: DataTypes.TEXT, allowNull: false },
    webhook_secret_encrypted:  { type: DataTypes.TEXT },
    price_list_id:             { type: DataTypes.UUID },
    default_contact_id:        { type: DataTypes.UUID },
    auto_publish:              { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    stock_safety_buffer:       { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: '0' },
    is_active:                 { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    last_order_synced_at:      { type: DataTypes.DATE },
    last_stock_pushed_at:      { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'woocommerce_sites', paranoid: true, underscored: true }
)

export default WoocommerceSite
