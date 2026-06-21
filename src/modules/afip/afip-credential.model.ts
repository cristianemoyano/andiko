import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

export const AFIP_CREDENTIAL_ENVIRONMENTS = ['homologacion', 'produccion'] as const
export type AfipCredentialEnvironment = typeof AFIP_CREDENTIAL_ENVIRONMENTS[number]

/**
 * Per-organization ARCA credentials. The X.509 certificate is public and stored
 * as plaintext PEM; the private key is stored encrypted at rest (see
 * `src/lib/crypto.ts`) and never returned to the client. One active credential
 * per (org, environment) is enforced by a partial unique index.
 */
export interface AfipCredentialAttributes extends Timestamps, AuditFields {
  id: UUID
  environment: AfipCredentialEnvironment
  cuit: string
  cert_pem: string
  key_encrypted: string
  label: string | null
  expires_at: Date | null
  is_active: boolean
}

type AfipCredentialCreationAttributes = Optional<
  AfipCredentialAttributes,
  | 'id' | 'label' | 'expires_at' | 'is_active'
  | 'created_at' | 'updated_at' | 'deleted_at' | 'created_by' | 'updated_by' | 'deleted_by'
>

class AfipCredential extends AuditModel<AfipCredentialAttributes, AfipCredentialCreationAttributes> {
  declare id: UUID
  declare environment: AfipCredentialEnvironment
  declare cuit: string
  declare cert_pem: string
  declare key_encrypted: string
  declare label: string | null
  declare expires_at: Date | null
  declare is_active: boolean
}

AfipCredential.init(
  {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    environment:   { type: DataTypes.STRING(20), allowNull: false },
    cuit:          { type: DataTypes.STRING(13), allowNull: false },
    cert_pem:      { type: DataTypes.TEXT, allowNull: false },
    key_encrypted: { type: DataTypes.TEXT, allowNull: false },
    label:         { type: DataTypes.STRING(120) },
    expires_at:    { type: DataTypes.DATE },
    is_active:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'afip_credentials', paranoid: true, underscored: true },
)

export default AfipCredential
