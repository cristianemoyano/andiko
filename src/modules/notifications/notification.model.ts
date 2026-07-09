import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'
import type { NotificationEventKey, NotificationRecipientKind } from './notification.schema'

export interface NotificationAttributes extends Timestamps {
  id: UUID
  org_id: UUID
  event_key: NotificationEventKey | string
  actor_id: UUID | null
  recipient_kind: NotificationRecipientKind
  recipient_user_id: UUID | null
  recipient_contact_id: UUID | null
  recipient_address: string | null
  payload: Record<string, unknown>
  read_at: Date | null
}

type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  'id' | 'actor_id' | 'recipient_user_id' | 'recipient_contact_id' | 'recipient_address'
  | 'payload' | 'read_at' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare event_key: string
  declare actor_id: UUID | null
  declare recipient_kind: NotificationRecipientKind
  declare recipient_user_id: UUID | null
  declare recipient_contact_id: UUID | null
  declare recipient_address: string | null
  declare payload: Record<string, unknown>
  declare read_at: Date | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: { type: DataTypes.UUID, allowNull: false },
    event_key: { type: DataTypes.STRING(64), allowNull: false },
    actor_id: { type: DataTypes.UUID, allowNull: true },
    recipient_kind: { type: DataTypes.STRING(16), allowNull: false },
    recipient_user_id: { type: DataTypes.UUID, allowNull: true },
    recipient_contact_id: { type: DataTypes.UUID, allowNull: true },
    recipient_address: { type: DataTypes.STRING(320), allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    read_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'notifications',
    paranoid: true,
    underscored: true,
  },
)

export default Notification
