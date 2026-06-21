import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

/**
 * Cached WSAA access tickets (TA) per org + service. AFIP throttles WSAA logins,
 * so the valid ticket (~12h) is reused across requests/invocations.
 */
export interface AfipAuthTokenAttributes extends Timestamps, AuditFields {
  id: UUID
  service: string
  token: string
  sign: string
  expires_at: Date
}

type AfipAuthTokenCreationAttributes = Optional<
  AfipAuthTokenAttributes,
  | 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class AfipAuthToken extends AuditModel<AfipAuthTokenAttributes, AfipAuthTokenCreationAttributes> {
  declare id: UUID
  declare service: string
  declare token: string
  declare sign: string
  declare expires_at: Date
}

AfipAuthToken.init(
  {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    service:    { type: DataTypes.STRING(20), allowNull: false },
    token:      { type: DataTypes.TEXT, allowNull: false },
    sign:       { type: DataTypes.TEXT, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'afip_auth_tokens', paranoid: true, underscored: true },
)

export default AfipAuthToken
