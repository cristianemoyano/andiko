import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

/**
 * Who an explicit share grants access to. Stored as VARCHAR + CHECK so `public_link` and
 * `org` (cross-tenant) can be added later without a schema migration. v1 supports the
 * in-org principals only.
 */
export type SharePrincipalType = 'user' | 'org_role' | 'branch'
export const SHARE_PRINCIPAL_TYPES: SharePrincipalType[] = ['user', 'org_role', 'branch']

export type SharePermission = 'read' | 'write'
export const SHARE_PERMISSIONS: SharePermission[] = ['read', 'write']

export interface FileShareAttributes extends Timestamps, AuditFields {
  id: UUID
  file_id: UUID
  principal_type: SharePrincipalType
  principal_id: UUID
  permission: SharePermission
  expires_at: Date | null
}

type FileShareCreationAttributes = Optional<
  FileShareAttributes,
  | 'id'
  | 'expires_at'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'deleted_by'
>

/** Explicit ReBAC grant on a file (on top of inherited access from linked records). */
class FileShare extends AuditModel<FileShareAttributes, FileShareCreationAttributes> {
  declare id: UUID
  declare file_id: UUID
  declare principal_type: SharePrincipalType
  declare principal_id: UUID
  declare permission: SharePermission
  declare expires_at: Date | null
}

FileShare.init(
  {
    id:             { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    file_id:        { type: DataTypes.UUID, allowNull: false },
    principal_type: { type: DataTypes.STRING(32), allowNull: false },
    principal_id:   { type: DataTypes.UUID, allowNull: false },
    permission:     { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'read' },
    expires_at:     { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'file_shares', paranoid: true, underscored: true },
)

export default FileShare
