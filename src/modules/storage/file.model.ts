import { DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import { AuditModel, auditColumnDefs } from '@/lib/base-model'
import type { UUID, Timestamps, AuditFields } from '@/types'

/** Lifecycle of a stored object under the presigned-upload flow. */
export type FileStatus = 'pending' | 'available' | 'failed'
export const FILE_STATUSES: FileStatus[] = ['pending', 'available', 'failed']

export interface FileAttributes extends Timestamps, AuditFields {
  id: UUID
  storage_provider: string
  storage_bucket: string
  storage_key: string
  original_filename: string
  content_type: string
  byte_size: string // BIGINT comes back as string from pg
  checksum_sha256: string | null
  status: FileStatus
  uploaded_at: Date | null
}

type FileCreationAttributes = Optional<
  FileAttributes,
  | 'id'
  | 'checksum_sha256'
  | 'status'
  | 'uploaded_at'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
  | 'created_by'
  | 'updated_by'
  | 'deleted_by'
>

/** A stored object's metadata. The bytes live in the storage backend, never in the DB. */
class FileModel extends AuditModel<FileAttributes, FileCreationAttributes> {
  declare id: UUID
  declare storage_provider: string
  declare storage_bucket: string
  declare storage_key: string
  declare original_filename: string
  declare content_type: string
  declare byte_size: string
  declare checksum_sha256: string | null
  declare status: FileStatus
  declare uploaded_at: Date | null
}

FileModel.init(
  {
    id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    storage_provider:  { type: DataTypes.STRING(32), allowNull: false },
    storage_bucket:    { type: DataTypes.STRING(255), allowNull: false },
    storage_key:       { type: DataTypes.TEXT, allowNull: false, unique: true },
    original_filename: { type: DataTypes.STRING(255), allowNull: false },
    content_type:      { type: DataTypes.STRING(255), allowNull: false },
    byte_size:         { type: DataTypes.BIGINT, allowNull: false },
    checksum_sha256:   { type: DataTypes.STRING(64) },
    status:            { type: DataTypes.ENUM(...FILE_STATUSES), allowNull: false, defaultValue: 'pending' },
    uploaded_at:       { type: DataTypes.DATE },
    ...auditColumnDefs,
  },
  { sequelize, tableName: 'files', paranoid: true, underscored: true },
)

export default FileModel
