import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

/**
 * Owner entity a file can be attached to. Stored as VARCHAR + CHECK (not a DB enum) because
 * the set grows as modules adopt attachments — see {@link OWNER_RESOLVERS} in owner-registry.ts.
 */
export type FileOwnerType = 'invoice' | 'product' | 'contact'
export const FILE_OWNER_TYPES: FileOwnerType[] = ['invoice', 'product', 'contact']

export interface FileLinkAttributes extends Timestamps, AuditFields {
  id: UUID
  file_id: UUID
  owner_type: FileOwnerType
  owner_id: UUID
  role: string | null
}

type FileLinkCreationAttributes = Optional<
  FileLinkAttributes,
  | 'id'
  | 'role'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'deleted_by'
>

/** Polymorphic many-to-many edge between a file and an owner record ("where is this linked"). */
class FileLink extends AuditModel<FileLinkAttributes, FileLinkCreationAttributes> {
  declare id: UUID
  declare file_id: UUID
  declare owner_type: FileOwnerType
  declare owner_id: UUID
  declare role: string | null
}

FileLink.init(
  {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    file_id:    { type: DataTypes.UUID, allowNull: false },
    owner_type: { type: DataTypes.STRING(64), allowNull: false },
    owner_id:   { type: DataTypes.UUID, allowNull: false },
    role:       { type: DataTypes.STRING(64) },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'file_links', paranoid: true, underscored: true },
)

export default FileLink
