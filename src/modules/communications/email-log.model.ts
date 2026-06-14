import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export type EmailLogStatus = 'sent' | 'failed'
export type EmailLogTransport = 'smtp' | 'log'

export interface EmailLogAttributes {
  id: UUID
  org_id: UUID
  document_domain: string
  document_type: string
  document_id: UUID
  recipient: string
  subject: string
  body_text: string | null
  body_html: string | null
  transport: EmailLogTransport | null
  message_id: string | null
  status: EmailLogStatus
  error: string | null
  sent_by: UUID | null
  created_at: Date
}

type EmailLogCreationAttributes = Optional<
  EmailLogAttributes,
  'id' | 'body_text' | 'body_html' | 'transport' | 'message_id' | 'error' | 'sent_by' | 'created_at'
>

export class EmailLog extends Model<EmailLogAttributes, EmailLogCreationAttributes> {
  declare id: UUID
  declare org_id: UUID
  declare document_domain: string
  declare document_type: string
  declare document_id: UUID
  declare recipient: string
  declare subject: string
  declare body_text: string | null
  declare body_html: string | null
  declare transport: EmailLogTransport | null
  declare message_id: string | null
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
    body_text: { type: DataTypes.TEXT, allowNull: true },
    body_html: { type: DataTypes.TEXT, allowNull: true },
    transport: { type: DataTypes.STRING(8), allowNull: true },
    message_id: { type: DataTypes.STRING(255), allowNull: true },
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
