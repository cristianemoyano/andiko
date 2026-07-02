import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID } from '@/types'

export interface TermsAcceptanceAttributes {
  id: UUID
  user_id: UUID
  terms_version: string
  accepted_at: Date
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

type TermsAcceptanceCreationAttributes = Optional<
  TermsAcceptanceAttributes,
  'id' | 'ip_address' | 'user_agent' | 'created_at'
>

export class TermsAcceptance extends Model<TermsAcceptanceAttributes, TermsAcceptanceCreationAttributes> {
  declare id: UUID
  declare user_id: UUID
  declare terms_version: string
  declare accepted_at: Date
  declare ip_address: string | null
  declare user_agent: string | null
  declare created_at: Date
}

TermsAcceptance.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    terms_version: { type: DataTypes.STRING(20), allowNull: false },
    accepted_at: { type: DataTypes.DATE, allowNull: false },
    ip_address: { type: DataTypes.STRING(45), allowNull: true },
    user_agent: { type: DataTypes.STRING(500), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: 'terms_acceptances',
    paranoid: false,
    underscored: true,
    updatedAt: false,
  },
)

export default TermsAcceptance
