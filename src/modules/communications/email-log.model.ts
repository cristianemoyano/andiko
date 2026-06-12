import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export type EmailLogStatus = 'sent' | 'failed'

export interface EmailLogAttributes {
  id: UUID
  org_id: UUID
  document_domain: string
  document_type: string
  document_id: UUID
  recipient: string
  subject: string
  status: EmailLogStatus
  error: string | null
  sent_by: UUID | null
  created_at: Date
}

type EmailLogCreationAttributes = Optional<
  EmailLogAttributes,
  'id' | 'error' | 'sent_by' | 'created_at'
>

export class EmailLog extends Model<EmailLogAttributes, EmailLogCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare document_domain: string
  declare document_type: string
  declare document_id: UUID
  declare recipient: string
  declare subject: string
  declare status: EmailLogStatus
  declare error: string | null
  declare sent_by: UUID | null
  declare created_at: Date
}

EmailLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    org_id: { type: DataTypes.UUID, allowNull: false },
    document_domain: { type: DataTypes.STRING(32), allowNull: false },
    document_type: { type: DataTypes.STRING(32), allowNull: false },
    document_id: { type: DataTypes.UUID, allowNull: false },
    recipient: { type: DataTypes.STRING(320), allowNull: false },
    subject: { type: DataTypes.STRING(500), allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sent' },
    error: { type: DataTypes.TEXT, allowNull: true },
    sent_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'email_logs',
    paranoid: false,
    underscored: true,
    updatedAt: false,
  },
)

export default EmailLog
