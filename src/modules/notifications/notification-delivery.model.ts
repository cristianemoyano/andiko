import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'
import type { NotificationChannel, NotificationDeliveryStatus } from './notification.schema'

export interface NotificationDeliveryAttributes {
  id: UUID
  notification_id: UUID
  org_id: UUID
  channel: NotificationChannel
  status: NotificationDeliveryStatus
  subject: string | null
  body_text: string | null
  body_html: string | null
  transport: string | null
  message_id: string | null
  error: string | null
  delivered_at: Date | null
  created_at: Date
  updated_at: Date
}

type NotificationDeliveryCreationAttributes = Optional<
  NotificationDeliveryAttributes,
  'id' | 'subject' | 'body_text' | 'body_html' | 'transport' | 'message_id' | 'error'
  | 'delivered_at' | 'created_at' | 'updated_at'
>

export class NotificationDelivery extends Model<
  NotificationDeliveryAttributes,
  NotificationDeliveryCreationAttributes
> {
  declare id: UUID
  declare notification_id: UUID
  declare org_id: UUID
  declare channel: NotificationChannel
  declare status: NotificationDeliveryStatus
  declare subject: string | null
  declare body_text: string | null
  declare body_html: string | null
  declare transport: string | null
  declare message_id: string | null
  declare error: string | null
  declare delivered_at: Date | null
  declare created_at: Date
  declare updated_at: Date
}

NotificationDelivery.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    notification_id: { type: DataTypes.UUID, allowNull: false },
    org_id: { type: DataTypes.UUID, allowNull: false },
    channel: { type: DataTypes.STRING(16), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    subject: { type: DataTypes.STRING(500), allowNull: true },
    body_text: { type: DataTypes.TEXT, allowNull: true },
    body_html: { type: DataTypes.TEXT, allowNull: true },
    transport: { type: DataTypes.STRING(16), allowNull: true },
    message_id: { type: DataTypes.STRING(255), allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'notification_deliveries',
    paranoid: false,
    underscored: true,
  },
)

export default NotificationDelivery
