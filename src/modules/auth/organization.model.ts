import { Model, DataTypes, Optional } from 'sequelize'
import sequelize from '@/lib/db'
import type { UUID, Timestamps } from '@/types'

export interface OnboardingData {
  company?: {
    razonSocial?: string
    cuit?: string
    condicionIVA?: string
    nombreComercial?: string
    actividad?: string
    calle?: string
    ciudad?: string
    provincia?: string
    cp?: string
    pais?: string
    telefono?: string
    email?: string
  }
  modules?: string[]
  productsMode?: 'manual' | 'csv' | 'later' | null
  integrations?: string[]
  sales?: {
    tipoFactura?: string
    puntoVenta?: string
    moneda?: string
    iva?: string
    incluirIVA?: boolean
    condPago?: string
  }
}

export interface OrganizationAttributes extends Timestamps {
  id: UUID
  name: string
  slug: string
  is_active: boolean
  onboarding_completed_at: Date | null
  onboarding_data: OnboardingData | null
}

type OrganizationCreationAttributes = Optional<
  OrganizationAttributes,
  'id' | 'is_active' | 'onboarding_completed_at' | 'onboarding_data' | 'created_at' | 'updated_at' | 'deleted_at'
>

export class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> {
  declare id: UUID
  declare name: string
  declare slug: string
  declare is_active: boolean
  declare onboarding_completed_at: Date | null
  declare onboarding_data: OnboardingData | null
  declare created_at: Date
  declare updated_at: Date
  declare deleted_at: Date | null
}

Organization.init(
  {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name:      { type: DataTypes.STRING(255), allowNull: false },
    slug:      { type: DataTypes.STRING(100), allowNull: false, unique: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    onboarding_completed_at: { type: DataTypes.DATE, allowNull: true },
    onboarding_data: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE },
  },
  { sequelize, tableName: 'organizations', paranoid: true, underscored: true }
)

export default Organization
